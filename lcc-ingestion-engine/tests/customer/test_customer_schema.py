import unittest

import pandas as pd

from app.services.customer.customer_schema import (
    CustomerValidationError,
    EXPECTED_COLUMNS,
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
        self.assertEqual(result.iloc[0]["BIRTHDAY"], "1996-02-29")
        self.assertEqual(result.iloc[0]["AGE"], 30)

    def test_rejects_schema_mismatch(self):
        row = valid_row()
        row.pop("CITY")
        row["UNKNOWN"] = "value"
        with self.assertRaisesRegex(CustomerValidationError, "Schema mismatch"):
            validate_and_cast_customer_frame(pd.DataFrame([row]))

    def test_rejects_invalid_dates_and_numbers(self):
        invalid_date = valid_row()
        invalid_date["BIRTHDAY"] = "20230229"
        with self.assertRaisesRegex(CustomerValidationError, "BIRTHDAY"):
            validate_and_cast_customer_frame(pd.DataFrame([invalid_date]))

        invalid_age = valid_row()
        invalid_age["AGE"] = "2.5"
        with self.assertRaisesRegex(CustomerValidationError, "AGE"):
            validate_and_cast_customer_frame(pd.DataFrame([invalid_age]))

    def test_rejects_missing_and_duplicate_customer_numbers(self):
        missing = valid_row()
        missing["CUSTOMER NUMBER"] = ""
        with self.assertRaisesRegex(CustomerValidationError, "required"):
            validate_and_cast_customer_frame(pd.DataFrame([missing]))

        first = valid_row()
        second = valid_row()
        second["CUSTOMER NUMBER"] = " c-100 "
        with self.assertRaisesRegex(CustomerValidationError, "unique within the file"):
            validate_and_cast_customer_frame(pd.DataFrame([first, second]))


if __name__ == "__main__":
    unittest.main()
