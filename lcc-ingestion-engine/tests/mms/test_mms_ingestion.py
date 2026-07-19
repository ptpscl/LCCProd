import csv
import io
import json
import unittest
from unittest.mock import MagicMock, call, patch

from app.services.mms import ingestion_service
from app.services.mms.ingestion_service import (
    BatchNotFoundError,
    InvalidMultiMonthError,
    InvalidMultiStoreError,
    SchemaMismatchError,
)
from app.services.mms import supabase_service


BATCH_ID = "11111111-1111-1111-1111-111111111111"


def valid_row(**overrides: str) -> dict[str, str]:
    row = {
        "DATE": "240102",
        "TRANSACTION NUMBER": "8712",
        "REGISTER NUMBER": "13",
        "STORE CODE": "417",
        "STORE CATEGORIZATION": "SUPERMARKET",
        "SKU CODE": "3778875",
        "TRANSACTION TYPE": "REGULAR SALE",
        "MMS SALES": "61.18",
        "QTY SOLD": "1.5",
        "MARGIN": "13.92",
    }
    row.update(overrides)
    return row


def csv_bytes(rows: list[dict[str, str]]) -> bytes:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=ingestion_service.EXPECTED_COLUMNS)
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


class MmsIngestionTests(unittest.TestCase):
    def setUp(self):
        patch_names = [
            "get_batch",
            "download_batch_file",
            "update_batch",
            "update_batch_meta",
            "check_existing_ingested_batch",
            "count_rows_for_batch",
            "insert_mms_rows",
            "delete_rows_for_batch",
        ]
        self.mocks = {}
        for name in patch_names:
            patcher = patch.object(ingestion_service, name)
            self.addCleanup(patcher.stop)
            self.mocks[name] = patcher.start()

        self.mocks["get_batch"].return_value = {
            "id": BATCH_ID,
            "file_path": f"mms/{BATCH_ID}/valid.csv",
            "status": "uploaded",
        }
        self.mocks["download_batch_file"].return_value = csv_bytes([valid_row()])
        self.mocks["check_existing_ingested_batch"].return_value = None
        self.mocks["count_rows_for_batch"].return_value = 0

    def test_successful_ingestion_saves_metadata_rows_and_status(self):
        result = ingestion_service.ingest_batch(BATCH_ID)

        self.assertEqual(
            result,
            {"batch_id": BATCH_ID, "rows_ingested": 1, "status": "ingested"},
        )
        self.mocks["update_batch_meta"].assert_called_once_with(
            BATCH_ID, "417", "2024-01"
        )
        records = self.mocks["insert_mms_rows"].call_args.args[0]
        self.assertEqual(records[0]["source_batch_id"], BATCH_ID)
        self.assertEqual(records[0]["MMS_SALES"], "61.18")
        self.mocks["insert_mms_rows"].assert_called_once_with(
            records, chunk_size=5_000
        )
        self.mocks["update_batch"].assert_called_once_with(
            BATCH_ID, 1, "ingested"
        )

    def test_insertion_records_use_empty_strings_for_blank_optional_values(self):
        self.mocks["download_batch_file"].return_value = csv_bytes(
            [
                valid_row(
                    **{
                        "STORE CATEGORIZATION": "   ",
                        "TRANSACTION TYPE": "",
                    }
                )
            ]
        )

        result = ingestion_service.ingest_batch(BATCH_ID)

        self.assertEqual(result["status"], "ingested")
        records = self.mocks["insert_mms_rows"].call_args.args[0]
        self.assertEqual(records[0]["STORE_CATEGORIZATION"], "")
        self.assertEqual(records[0]["TRANSACTION_TYPE"], "")
        self.assertNotIn(
            records[0]["STORE_CATEGORIZATION"], {"nan", "None", "<NA>"}
        )
        self.assertNotIn(records[0]["TRANSACTION_TYPE"], {"nan", "None", "<NA>"})

    def test_insertion_records_preserve_high_precision_as_json_safe_strings(self):
        high_precision = "123456789012345678901234567890.123456789"
        self.mocks["download_batch_file"].return_value = csv_bytes(
            [valid_row(**{"MMS SALES": high_precision, "QTY SOLD": "-0.000"})]
        )

        result = ingestion_service.ingest_batch(BATCH_ID)

        self.assertEqual(result["status"], "ingested")
        records = self.mocks["insert_mms_rows"].call_args.args[0]
        self.assertEqual(records[0]["MMS_SALES"], high_precision)
        self.assertEqual(records[0]["QTY_SOLD"], "0")
        for column in ["MMS_SALES", "QTY_SOLD", "MARGIN"]:
            self.assertIsInstance(records[0][column], str)
        self.assertIsInstance(json.dumps(records), str)

    def test_missing_batch_raises_not_found_without_status_update(self):
        self.mocks["get_batch"].return_value = None

        with self.assertRaises(BatchNotFoundError):
            ingestion_service.ingest_batch(BATCH_ID)

        self.mocks["update_batch"].assert_not_called()
        self.mocks["download_batch_file"].assert_not_called()

    def test_missing_file_path_is_ingestion_failed(self):
        self.mocks["get_batch"].return_value = {"id": BATCH_ID, "file_path": "  "}

        with self.assertRaisesRegex(SchemaMismatchError, "no file_path"):
            ingestion_service.ingest_batch(BATCH_ID)

        self.mocks["update_batch"].assert_called_once_with(
            BATCH_ID, None, "ingestion_failed"
        )
        self.mocks["download_batch_file"].assert_not_called()

    def test_download_failure_is_ingestion_failed(self):
        self.mocks["download_batch_file"].side_effect = RuntimeError("unavailable")

        with self.assertRaisesRegex(RuntimeError, "download failed"):
            ingestion_service.ingest_batch(BATCH_ID)

        self.mocks["update_batch"].assert_called_once_with(
            BATCH_ID, None, "ingestion_failed"
        )
        self.mocks["insert_mms_rows"].assert_not_called()

    def test_exact_duplicates_fail_before_insertion(self):
        self.mocks["download_batch_file"].return_value = csv_bytes(
            [valid_row(), valid_row()]
        )

        with self.assertRaisesRegex(SchemaMismatchError, "Exact duplicate"):
            ingestion_service.ingest_batch(BATCH_ID)

        self.mocks["insert_mms_rows"].assert_not_called()
        self.mocks["update_batch"].assert_called_once_with(
            BATCH_ID, None, "ingestion_failed"
        )

    def test_multiple_stores_and_months_use_loyalty_statuses(self):
        self.mocks["download_batch_file"].return_value = csv_bytes(
            [valid_row(), valid_row(**{"STORE CODE": "418"})]
        )
        with self.assertRaises(InvalidMultiStoreError):
            ingestion_service.ingest_batch(BATCH_ID)
        self.mocks["update_batch"].assert_called_once_with(
            BATCH_ID, None, "invalid_multi_store"
        )

        self.mocks["update_batch"].reset_mock()
        self.mocks["download_batch_file"].return_value = csv_bytes(
            [valid_row(), valid_row(**{"DATE": "240201"})]
        )
        with self.assertRaises(InvalidMultiMonthError):
            ingestion_service.ingest_batch(BATCH_ID)
        self.mocks["update_batch"].assert_called_once_with(
            BATCH_ID, None, "invalid_multi_month"
        )

    def test_store_month_duplicate_sets_duplicate_suspected(self):
        self.mocks["check_existing_ingested_batch"].return_value = "existing-batch"

        result = ingestion_service.ingest_batch(BATCH_ID)

        self.assertEqual(result["status"], "duplicate_suspected")
        self.assertEqual(result["existing_batch_id"], "existing-batch")
        self.assertEqual(result["rows_ingested"], 0)
        self.mocks["update_batch"].assert_called_once_with(
            BATCH_ID, None, "duplicate_suspected"
        )
        self.mocks["count_rows_for_batch"].assert_not_called()
        self.mocks["insert_mms_rows"].assert_not_called()

    def test_existing_source_batch_rows_return_already_ingested(self):
        self.mocks["count_rows_for_batch"].return_value = 25

        result = ingestion_service.ingest_batch(BATCH_ID)

        self.assertEqual(
            result,
            {"batch_id": BATCH_ID, "rows_ingested": 0, "status": "already_ingested"},
        )
        self.mocks["insert_mms_rows"].assert_not_called()
        self.mocks["update_batch"].assert_not_called()

    def test_partial_insertion_failure_rolls_back_and_marks_failed(self):
        self.mocks["insert_mms_rows"].side_effect = RuntimeError("insert failed")

        with self.assertRaisesRegex(RuntimeError, "MMS insertion failed"):
            ingestion_service.ingest_batch(BATCH_ID)

        self.mocks["delete_rows_for_batch"].assert_called_once_with(BATCH_ID)
        self.mocks["update_batch"].assert_called_once_with(
            BATCH_ID, None, "ingestion_failed"
        )

    def test_general_validation_failure_uses_ingestion_failed(self):
        self.mocks["download_batch_file"].return_value = csv_bytes(
            [valid_row(**{"SKU CODE": ""})]
        )

        with self.assertRaisesRegex(SchemaMismatchError, "Required"):
            ingestion_service.ingest_batch(BATCH_ID)

        self.mocks["insert_mms_rows"].assert_not_called()
        self.mocks["update_batch"].assert_called_once_with(
            BATCH_ID, None, "ingestion_failed"
        )


class MmsSupabaseServiceTests(unittest.TestCase):
    @patch.object(supabase_service, "get_client")
    def test_insert_rows_uses_5000_row_chunks(self, get_client):
        client = MagicMock()
        get_client.return_value = client
        rows = [{"row": index} for index in range(10_001)]

        supabase_service.insert_mms_rows(rows)

        table = client.table
        self.assertEqual(table.call_args_list, [call("bronze_mms")] * 3)
        insert_sizes = [
            len(table.return_value.insert.call_args_list[index].args[0])
            for index in range(3)
        ]
        self.assertEqual(insert_sizes, [5_000, 5_000, 1])


if __name__ == "__main__":
    unittest.main()
