import csv
import io
import json
import unittest
from unittest.mock import MagicMock, call, patch

from app.services.mms import ingestion_service, supabase_service
from app.services.mms.ingestion_service import (
    BatchNotFoundError,
    InvalidMultiMonthError,
    InvalidMultiStoreError,
    SchemaMismatchError,
)


BATCH_ID = "11111111-1111-1111-1111-111111111111"


def valid_row(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
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


def csv_bytes(rows: list[dict[str, object]]) -> bytes:
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
        self.mocks["count_rows_for_batch"].return_value = 0
        self.mocks["download_batch_file"].return_value = csv_bytes([valid_row()])
        self.mocks["check_existing_ingested_batch"].return_value = None

    def inserted_records(self) -> list[dict]:
        return self.mocks["insert_mms_rows"].call_args.args[0]

    def test_successful_ingestion_saves_metadata_rows_and_status(self):
        result = ingestion_service.ingest_batch(BATCH_ID)

        self.assertEqual(
            result,
            {"batch_id": BATCH_ID, "rows_ingested": 1, "status": "ingested"},
        )
        self.mocks["count_rows_for_batch"].assert_called_once_with(BATCH_ID)
        self.mocks["delete_rows_for_batch"].assert_not_called()
        self.mocks["update_batch_meta"].assert_called_once_with(
            BATCH_ID, "417", "2024-01"
        )
        records = self.inserted_records()
        self.assertEqual(records[0]["source_batch_id"], BATCH_ID)
        self.assertEqual(records[0]["MMS_SALES"], "61.18")
        self.mocks["insert_mms_rows"].assert_called_once_with(
            records, chunk_size=5_000
        )
        self.mocks["update_batch"].assert_called_once_with(
            BATCH_ID, 1, "ingested"
        )

    def test_empty_cells_in_all_source_columns_insert_as_none(self):
        self.mocks["download_batch_file"].return_value = csv_bytes(
            [{column: "" for column in ingestion_service.EXPECTED_COLUMNS}]
        )

        result = ingestion_service.ingest_batch(BATCH_ID)

        self.assertEqual(result["status"], "ingested")
        record = self.inserted_records()[0]
        for column in ingestion_service.DATABASE_COLUMNS:
            self.assertIsNone(record[column], column)
        self.assertEqual(record["source_batch_id"], BATCH_ID)
        json.dumps([record], allow_nan=False)
        self.mocks["update_batch_meta"].assert_called_once_with(
            BATCH_ID, None, None
        )
        self.mocks["check_existing_ingested_batch"].assert_not_called()

    def test_nonempty_and_whitespace_source_text_is_preserved_exactly(self):
        source = valid_row(
            **{
                "DATE": " not-a-date ",
                "TRANSACTION NUMBER": "  8712  ",
                "REGISTER NUMBER": "\t13\t",
                "STORE CODE": "  store1  ",
                "STORE CATEGORIZATION": "   ",
                "SKU CODE": " 003778875 ",
                "TRANSACTION TYPE": "\t",
                "MMS SALES": "$ 10.00 ",
                "QTY SOLD": " unknown ",
                "MARGIN": " -0.000 ",
            }
        )
        self.mocks["download_batch_file"].return_value = csv_bytes([source])

        ingestion_service.ingest_batch(BATCH_ID)

        record = self.inserted_records()[0]
        for source_column, database_column in zip(
            ingestion_service.EXPECTED_COLUMNS,
            ingestion_service.DATABASE_COLUMNS,
        ):
            self.assertEqual(record[database_column], source[source_column])
        self.mocks["update_batch_meta"].assert_called_once_with(
            BATCH_ID, "store1", None
        )

    def test_malformed_dates_and_arbitrary_measure_text_insert_unchanged(self):
        rows = [
            valid_row(
                **{
                    "TRANSACTION NUMBER": "1",
                    "DATE": "240231",
                    "MMS SALES": "unknown",
                    "QTY SOLD": "NaN",
                    "MARGIN": "Infinity",
                }
            ),
            valid_row(
                **{
                    "TRANSACTION NUMBER": "2",
                    "DATE": "not-a-date",
                    "MMS SALES": "1e-1000",
                    "QTY SOLD": "PHP 1,234.50",
                    "MARGIN": "-0.000",
                }
            ),
        ]
        self.mocks["download_batch_file"].return_value = csv_bytes(rows)

        ingestion_service.ingest_batch(BATCH_ID)

        records = self.inserted_records()
        self.assertEqual(records[0]["DATE"], "240231")
        self.assertEqual(records[0]["MMS_SALES"], "unknown")
        self.assertEqual(records[0]["QTY_SOLD"], "NaN")
        self.assertEqual(records[0]["MARGIN"], "Infinity")
        self.assertEqual(records[1]["DATE"], "not-a-date")
        self.assertEqual(records[1]["MMS_SALES"], "1e-1000")
        self.assertEqual(records[1]["QTY_SOLD"], "PHP 1,234.50")
        self.assertEqual(records[1]["MARGIN"], "-0.000")
        self.mocks["update_batch_meta"].assert_called_once_with(
            BATCH_ID, "417", "2024-02"
        )

    def test_high_precision_and_trailing_zeros_remain_json_safe_strings(self):
        high_precision = "10.123456789012345678901234567890"
        self.mocks["download_batch_file"].return_value = csv_bytes(
            [
                valid_row(
                    **{
                        "MMS SALES": high_precision,
                        "QTY SOLD": "1.00",
                        "MARGIN": "-0.000",
                    }
                )
            ]
        )

        ingestion_service.ingest_batch(BATCH_ID)

        record = self.inserted_records()[0]
        self.assertEqual(record["MMS_SALES"], high_precision)
        self.assertEqual(record["QTY_SOLD"], "1.00")
        self.assertEqual(record["MARGIN"], "-0.000")
        self.assertTrue(
            all(
                value is None or isinstance(value, str)
                for value in record.values()
            )
        )
        json.dumps([record], allow_nan=False)

    def test_literal_null_and_leading_numeric_zeros_remain_text(self):
        self.mocks["download_batch_file"].return_value = csv_bytes(
            [
                valid_row(
                    **{
                        "TRANSACTION TYPE": "NULL",
                        "MMS SALES": "00010.0500",
                    }
                )
            ]
        )

        ingestion_service.ingest_batch(BATCH_ID)

        record = self.inserted_records()[0]
        self.assertEqual(record["TRANSACTION_TYPE"], "NULL")
        self.assertEqual(record["MMS_SALES"], "00010.0500")

    def test_duplicate_rows_are_both_inserted_and_counted(self):
        duplicate = valid_row(
            **{
                "REGISTER NUMBER": "",
                "TRANSACTION TYPE": "",
            }
        )
        self.mocks["download_batch_file"].return_value = csv_bytes(
            [duplicate, duplicate.copy()]
        )

        result = ingestion_service.ingest_batch(BATCH_ID)

        self.assertEqual(result["rows_ingested"], 2)
        records = self.inserted_records()
        self.assertEqual(len(records), 2)
        self.assertEqual(records[0], records[1])
        self.assertIsNone(records[0]["REGISTER_NUMBER"])
        self.assertIsNone(records[0]["TRANSACTION_TYPE"])
        json.dumps(records, allow_nan=False)
        self.mocks["update_batch"].assert_called_once_with(
            BATCH_ID, 2, "ingested"
        )

    def test_one_store_plus_blank_and_whitespace_stores_succeeds(self):
        rows = [
            valid_row(**{"TRANSACTION NUMBER": "1", "STORE CODE": "  store1  "}),
            valid_row(**{"TRANSACTION NUMBER": "2", "STORE CODE": ""}),
            valid_row(**{"TRANSACTION NUMBER": "3", "STORE CODE": "   "}),
        ]
        self.mocks["download_batch_file"].return_value = csv_bytes(rows)

        ingestion_service.ingest_batch(BATCH_ID)

        self.mocks["update_batch_meta"].assert_called_once_with(
            BATCH_ID, "store1", "2024-01"
        )
        records = self.inserted_records()
        self.assertEqual(
            [record["STORE_CODE"] for record in records],
            ["  store1  ", None, "   "],
        )

    def test_all_blank_stores_and_unusable_dates_save_null_metadata(self):
        rows = [
            valid_row(
                **{
                    "TRANSACTION NUMBER": "1",
                    "STORE CODE": "",
                    "DATE": "not-a-date",
                }
            ),
            valid_row(
                **{
                    "TRANSACTION NUMBER": "2",
                    "STORE CODE": "   ",
                    "DATE": "241301",
                }
            ),
        ]
        self.mocks["download_batch_file"].return_value = csv_bytes(rows)

        ingestion_service.ingest_batch(BATCH_ID)

        self.mocks["update_batch_meta"].assert_called_once_with(
            BATCH_ID, None, None
        )
        self.mocks["check_existing_ingested_batch"].assert_not_called()

    def test_multiple_trimmed_or_case_distinct_stores_use_loyalty_status(self):
        cases = [(" store1 ", "store2"), ("store1", "STORE1")]
        for first, second in cases:
            with self.subTest(first=first, second=second):
                self.mocks["update_batch"].reset_mock()
                self.mocks["download_batch_file"].return_value = csv_bytes(
                    [
                        valid_row(**{"TRANSACTION NUMBER": "1", "STORE CODE": first}),
                        valid_row(**{"TRANSACTION NUMBER": "2", "STORE CODE": second}),
                    ]
                )

                with self.assertRaises(InvalidMultiStoreError):
                    ingestion_service.ingest_batch(BATCH_ID)

                self.mocks["update_batch"].assert_called_once_with(
                    BATCH_ID, None, "invalid_multi_store"
                )
                self.mocks["insert_mms_rows"].assert_not_called()

    def test_one_usable_month_ignores_unusable_dates(self):
        source_dates = ["240231", "not-a-date", "241301", "", "   "]
        rows = [
            valid_row(**{"TRANSACTION NUMBER": str(index), "DATE": value})
            for index, value in enumerate(source_dates)
        ]
        self.mocks["download_batch_file"].return_value = csv_bytes(rows)

        ingestion_service.ingest_batch(BATCH_ID)

        self.mocks["update_batch_meta"].assert_called_once_with(
            BATCH_ID, "417", "2024-02"
        )
        self.assertEqual(
            [record["DATE"] for record in self.inserted_records()],
            ["240231", "not-a-date", "241301", None, "   "],
        )

    def test_two_detected_months_use_loyalty_status(self):
        self.mocks["download_batch_file"].return_value = csv_bytes(
            [
                valid_row(**{"TRANSACTION NUMBER": "1", "DATE": "240231"}),
                valid_row(**{"TRANSACTION NUMBER": "2", "DATE": "240301"}),
            ]
        )

        with self.assertRaises(InvalidMultiMonthError):
            ingestion_service.ingest_batch(BATCH_ID)

        self.mocks["update_batch"].assert_called_once_with(
            BATCH_ID, None, "invalid_multi_month"
        )
        self.mocks["insert_mms_rows"].assert_not_called()

    def test_store_month_duplicate_sets_duplicate_suspected(self):
        self.mocks["check_existing_ingested_batch"].return_value = "older-batch"

        result = ingestion_service.ingest_batch(BATCH_ID)

        self.assertEqual(result["status"], "duplicate_suspected")
        self.assertEqual(result["existing_batch_id"], "older-batch")
        self.mocks["check_existing_ingested_batch"].assert_called_once_with(
            BATCH_ID, "417", "2024-01"
        )
        self.mocks["update_batch"].assert_called_once_with(
            BATCH_ID, None, "duplicate_suspected"
        )
        self.mocks["insert_mms_rows"].assert_not_called()

    def test_null_store_or_month_bypasses_duplicate_batch_lookup(self):
        cases = [
            {"STORE CODE": "", "DATE": "240102"},
            {"STORE CODE": "417", "DATE": "not-a-date"},
        ]
        for overrides in cases:
            with self.subTest(overrides=overrides):
                self.mocks["check_existing_ingested_batch"].reset_mock()
                self.mocks["insert_mms_rows"].reset_mock()
                self.mocks["update_batch"].reset_mock()
                self.mocks["download_batch_file"].return_value = csv_bytes(
                    [valid_row(**overrides)]
                )

                result = ingestion_service.ingest_batch(BATCH_ID)

                self.assertEqual(result["status"], "ingested")
                self.mocks["check_existing_ingested_batch"].assert_not_called()

    def test_batch_idempotency_precedes_download_and_metadata_operations(self):
        self.mocks["count_rows_for_batch"].return_value = 2
        self.mocks["get_batch"].return_value = {
            "id": BATCH_ID,
            "file_path": None,
            "status": "ingested",
            "row_count": 2,
        }

        result = ingestion_service.ingest_batch(BATCH_ID)

        self.assertEqual(
            result,
            {"batch_id": BATCH_ID, "rows_ingested": 0, "status": "already_ingested"},
        )
        self.mocks["download_batch_file"].assert_not_called()
        self.mocks["update_batch_meta"].assert_not_called()
        self.mocks["check_existing_ingested_batch"].assert_not_called()
        self.mocks["insert_mms_rows"].assert_not_called()
        self.mocks["update_batch"].assert_not_called()

    def test_ingestion_failed_partial_rows_are_cleaned_and_retried(self):
        self.mocks["get_batch"].return_value["status"] = "ingestion_failed"
        self.mocks["get_batch"].return_value["row_count"] = None
        self.mocks["count_rows_for_batch"].side_effect = [2, 0]

        result = ingestion_service.ingest_batch(BATCH_ID)

        self.assertEqual(result["status"], "ingested")
        self.assertEqual(
            self.mocks["count_rows_for_batch"].call_args_list,
            [call(BATCH_ID), call(BATCH_ID)],
        )
        self.mocks["delete_rows_for_batch"].assert_called_once_with(BATCH_ID)
        self.mocks["download_batch_file"].assert_called_once()
        self.mocks["insert_mms_rows"].assert_called_once()

    def test_uploaded_partial_rows_are_cleaned_and_retried(self):
        self.mocks["get_batch"].return_value["status"] = "uploaded"
        self.mocks["get_batch"].return_value["row_count"] = None
        self.mocks["count_rows_for_batch"].side_effect = [1, 0]

        result = ingestion_service.ingest_batch(BATCH_ID)

        self.assertEqual(result["status"], "ingested")
        self.mocks["delete_rows_for_batch"].assert_called_once_with(BATCH_ID)
        self.mocks["download_batch_file"].assert_called_once()
        self.mocks["insert_mms_rows"].assert_called_once()

    def test_partial_cleanup_error_stops_before_download_or_insertion(self):
        self.mocks["get_batch"].return_value["status"] = "ingestion_failed"
        self.mocks["count_rows_for_batch"].return_value = 2
        self.mocks["delete_rows_for_batch"].side_effect = RuntimeError(
            "cleanup failed"
        )

        with self.assertRaisesRegex(RuntimeError, "safely clean up"):
            ingestion_service.ingest_batch(BATCH_ID)

        self.mocks["delete_rows_for_batch"].assert_called_once_with(BATCH_ID)
        self.mocks["update_batch"].assert_called_once_with(
            BATCH_ID, None, "ingestion_failed"
        )
        self.mocks["download_batch_file"].assert_not_called()
        self.mocks["insert_mms_rows"].assert_not_called()

    def test_partial_cleanup_recount_detects_remaining_rows_and_stops(self):
        self.mocks["get_batch"].return_value["status"] = "uploaded"
        self.mocks["count_rows_for_batch"].side_effect = [2, 1]

        with self.assertRaisesRegex(RuntimeError, "safely clean up"):
            ingestion_service.ingest_batch(BATCH_ID)

        self.assertEqual(
            self.mocks["count_rows_for_batch"].call_args_list,
            [call(BATCH_ID), call(BATCH_ID)],
        )
        self.mocks["delete_rows_for_batch"].assert_called_once_with(BATCH_ID)
        self.mocks["update_batch"].assert_called_once_with(
            BATCH_ID, None, "ingestion_failed"
        )
        self.mocks["download_batch_file"].assert_not_called()
        self.mocks["insert_mms_rows"].assert_not_called()

    def test_unconfirmed_ingested_counts_use_safe_cleanup_and_retry(self):
        cases = [None, 1, 3]
        for stored_row_count in cases:
            with self.subTest(stored_row_count=stored_row_count):
                self.mocks["get_batch"].return_value["status"] = "ingested"
                self.mocks["get_batch"].return_value["row_count"] = stored_row_count
                self.mocks["count_rows_for_batch"].side_effect = [2, 0]

                result = ingestion_service.ingest_batch(BATCH_ID)

                self.assertEqual(result["status"], "ingested")
                self.mocks["delete_rows_for_batch"].assert_called_once_with(BATCH_ID)
                self.mocks["download_batch_file"].assert_called_once()
                self.mocks["insert_mms_rows"].assert_called_once()

                self.mocks["delete_rows_for_batch"].reset_mock()
                self.mocks["download_batch_file"].reset_mock()
                self.mocks["insert_mms_rows"].reset_mock()
                self.mocks["update_batch"].reset_mock()
                self.mocks["update_batch_meta"].reset_mock()
                self.mocks["check_existing_ingested_batch"].reset_mock()
                self.mocks["count_rows_for_batch"].reset_mock()

    def test_missing_batch_raises_not_found_before_idempotency_check(self):
        self.mocks["get_batch"].return_value = None

        with self.assertRaises(BatchNotFoundError):
            ingestion_service.ingest_batch(BATCH_ID)

        self.mocks["count_rows_for_batch"].assert_not_called()
        self.mocks["update_batch"].assert_not_called()

    def test_missing_file_path_is_ingestion_failed(self):
        self.mocks["get_batch"].return_value = {"id": BATCH_ID, "file_path": "  "}

        with self.assertRaisesRegex(SchemaMismatchError, "no file_path"):
            ingestion_service.ingest_batch(BATCH_ID)

        self.mocks["update_batch"].assert_called_once_with(
            BATCH_ID, None, "ingestion_failed"
        )
        self.mocks["download_batch_file"].assert_not_called()

    def test_download_failure_is_ingestion_failed(self):
        self.mocks["download_batch_file"].side_effect = RuntimeError("download failed")

        with self.assertRaisesRegex(RuntimeError, "download failed"):
            ingestion_service.ingest_batch(BATCH_ID)

        self.mocks["update_batch"].assert_called_once_with(
            BATCH_ID, None, "ingestion_failed"
        )
        self.mocks["insert_mms_rows"].assert_not_called()

    def test_header_only_file_is_ingestion_failed_without_insertion(self):
        self.mocks["download_batch_file"].return_value = csv_bytes([])

        with self.assertRaisesRegex(SchemaMismatchError, "no data rows"):
            ingestion_service.ingest_batch(BATCH_ID)

        self.mocks["insert_mms_rows"].assert_not_called()
        self.mocks["update_batch"].assert_called_once_with(
            BATCH_ID, None, "ingestion_failed"
        )

    def test_partial_insertion_failure_rolls_back_only_current_batch(self):
        self.mocks["insert_mms_rows"].side_effect = RuntimeError("insert failed")

        with self.assertRaisesRegex(RuntimeError, "MMS insertion failed"):
            ingestion_service.ingest_batch(BATCH_ID)

        self.mocks["delete_rows_for_batch"].assert_called_once_with(BATCH_ID)
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

    @patch.object(supabase_service, "get_client")
    def test_null_metadata_duplicate_check_does_not_contact_supabase(self, get_client):
        self.assertIsNone(
            supabase_service.check_existing_ingested_batch(BATCH_ID, None, "2024-01")
        )
        self.assertIsNone(
            supabase_service.check_existing_ingested_batch(BATCH_ID, "417", None)
        )
        get_client.assert_not_called()


if __name__ == "__main__":
    unittest.main()
