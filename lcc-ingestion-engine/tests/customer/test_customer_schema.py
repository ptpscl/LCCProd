import json
import tempfile
import unittest
from pathlib import Path

import pandas as pd

from app.services.customer.customer_schema import (
    CustomerValidationError,
    EXPECTED_COLUMNS,
    iter_customer_csv_chunks,
    read_customer_csv,
    to_json_safe_records,
    validate_and_cast_customer_frame,
)


def valid_row() -> dict[str, str]:
    return {
        "CUSTOMER NUMBER": "C-100",
        "GENDER": "F",
        "BIRTHDAY": "19960229",
        "AGE": "30",
        "CITY": "Cebu City",
        "PROVINCE": "Cebu",
        "EXPIRY DATE": "20271231",
        "MEMBER LOCATION": "001",
        "APPLICATION DATE": "20200101",
        "MEMBER SINCE": "20200102",
        "LAST VISIT": "20260701",
        "FREQUENCY OF VISIT": "12",
        "LAST VISITED STORE": "001",
    }


class CustomerSchemaTests(unittest.TestCase):
    def test_validates_and_casts_a_valid_record(self):
        frame = pd.DataFrame([valid_row()])
        frame.columns = [column.lower() for column in frame.columns]
        result = validate_and_cast_customer_frame(frame)
        self.assertEqual(result.columns.tolist(), EXPECTED_COLUMNS)
        self.assertEqual(result.iloc[0]["BIRTHDAY"], "19960229")
        self.assertEqual(result.iloc[0]["AGE"], "30")

    def test_rejects_schema_mismatch(self):
        row = valid_row()
        row.pop("CITY")
        row["UNKNOWN"] = "value"
        with self.assertRaisesRegex(CustomerValidationError, "Schema mismatch"):
            validate_and_cast_customer_frame(pd.DataFrame([row]))

    def test_preserves_raw_date_values(self):
        raw_dates = valid_row()
        raw_dates["BIRTHDAY"] = "10112"
        raw_dates["LAST VISIT"] = "not-normalized-yet"
        result = validate_and_cast_customer_frame(pd.DataFrame([raw_dates]))
        self.assertEqual(result.iloc[0]["BIRTHDAY"], "10112")
        self.assertEqual(result.iloc[0]["LAST VISIT"], "not-normalized-yet")

    def test_preserves_raw_numeric_values_as_text(self):
        raw_numbers = valid_row()
        raw_numbers["AGE"] = "unknown"
        raw_numbers["FREQUENCY OF VISIT"] = "2.5"
        result = validate_and_cast_customer_frame(pd.DataFrame([raw_numbers]))
        self.assertEqual(result.iloc[0]["AGE"], "unknown")
        self.assertEqual(result.iloc[0]["FREQUENCY OF VISIT"], "2.5")

    def test_rejects_missing_customer_numbers(self):
        missing = valid_row()
        missing["CUSTOMER NUMBER"] = ""
        with self.assertRaisesRegex(CustomerValidationError, "required"):
            validate_and_cast_customer_frame(pd.DataFrame([missing]))

    def test_allows_repeated_customer_number_when_other_columns_differ(self):
        first = valid_row()
        second = valid_row()
        second["CUSTOMER NUMBER"] = " c-100 "
        second["CITY"] = "Mandaue City"
        result = validate_and_cast_customer_frame(pd.DataFrame([first, second]))
        self.assertEqual(len(result), 2)
        self.assertEqual(result["CUSTOMER NUMBER"].tolist(), ["C-100", "C-100"])

    def test_rejects_fully_identical_rows(self):
        first = valid_row()
        second = valid_row()
        with self.assertRaisesRegex(CustomerValidationError, "Fully identical"):
            validate_and_cast_customer_frame(pd.DataFrame([first, second]))

    def test_converts_blank_cells_to_json_null(self):
        row = valid_row()
        row["PROVINCE"] = None
        row["EXPIRY DATE"] = ""
        frame = validate_and_cast_customer_frame(pd.DataFrame([row]))
        frame["source_batch_id"] = "batch-1"
        records = to_json_safe_records(frame)

        self.assertIsNone(records[0]["PROVINCE"])
        self.assertIsNone(records[0]["EXPIRY DATE"])
        json.dumps(records, allow_nan=False)

    def test_reads_windows_1252_customer_csv(self):
        header = ",".join(EXPECTED_COLUMNS)
        row = valid_row()
        row["CITY"] = "PEÑA CITY"
        csv_text = header + "\n" + ",".join(row[column] for column in EXPECTED_COLUMNS)

        frame, encoding = read_customer_csv(csv_text.encode("cp1252"))

        self.assertEqual(encoding, "cp1252")
        self.assertEqual(frame.iloc[0]["CITY"], "PEÑA CITY")

    def test_reads_large_customer_file_in_bounded_chunks(self):
        header = ",".join(EXPECTED_COLUMNS)
        row = valid_row()
        rows = []
        for index in range(5):
            current = {**row, "CUSTOMER NUMBER": f"C-{index}"}
            rows.append(",".join(current[column] for column in EXPECTED_COLUMNS))
        file_bytes = (header + "\n" + "\n".join(rows)).encode("utf-8")

        chunks, encoding = iter_customer_csv_chunks(file_bytes, chunk_size=2)
        chunk_sizes = [len(chunk) for chunk in chunks]

        self.assertEqual(encoding, "utf-8-sig")
        self.assertEqual(chunk_sizes, [2, 2, 1])

    def test_reads_customer_file_from_disk_in_bounded_chunks(self):
        header = ",".join(EXPECTED_COLUMNS)
        row = valid_row()
        file_bytes = (
            header + "\n" + ",".join(row[column] for column in EXPECTED_COLUMNS)
        ).encode("utf-8")

        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "customers.csv"
            csv_path.write_bytes(file_bytes)
            chunks, encoding = iter_customer_csv_chunks(csv_path, chunk_size=2)
            chunk_sizes = [len(chunk) for chunk in chunks]

        self.assertEqual(encoding, "utf-8-sig")
        self.assertEqual(chunk_sizes, [1])


if __name__ == "__main__":
    unittest.main()
