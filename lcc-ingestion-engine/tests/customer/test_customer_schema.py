import json
import unittest

import pandas as pd

from app.services.customer.customer_schema import (
    CustomerValidationError,
    EXPECTED_COLUMNS,
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


if __name__ == "__main__":
    unittest.main()
