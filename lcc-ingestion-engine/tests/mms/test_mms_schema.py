import unittest

import pandas as pd

from app.services.mms.ingestion_service import (
    DATABASE_COLUMNS,
    EXPECTED_COLUMNS,
    InvalidMultiMonthError,
    InvalidMultiStoreError,
    OPTIONAL_VALUE_COLUMNS,
    REQUIRED_VALUE_COLUMNS,
    SchemaMismatchError,
    validate_and_normalize_mms_frame,
)


def valid_row(**overrides: str) -> dict[str, str]:
    row = {
        "DATE": "240102",
        "TRANSACTION NUMBER": "8712",
        "REGISTER NUMBER": "13",
        "STORE CODE": "417",
        "STORE CATEGORIZATION": "SUPERMARKET",
        "SKU CODE": "3778875",
        "TRANSACTION TYPE": "REGULAR SALE",
        "MMS SALES": "61.186650185414",
        "QTY SOLD": "0.61804697156984",
        "MARGIN": "13.921508034611",
    }
    row.update(overrides)
    return row


class MmsSchemaTests(unittest.TestCase):
    def test_accepts_valid_data_and_maps_bronze_columns(self):
        frame = pd.DataFrame(
            [
                valid_row(),
                valid_row(
                    **{
                        "TRANSACTION NUMBER": "8713",
                        "MMS SALES": "0",
                        "QTY SOLD": "-1.50",
                        "MARGIN": "-0.00",
                    }
                ),
            ],
            columns=EXPECTED_COLUMNS,
        )

        result = validate_and_normalize_mms_frame(frame)

        self.assertEqual(result.columns.tolist(), DATABASE_COLUMNS)
        self.assertEqual(result.iloc[0]["DATE"], "240102")
        self.assertEqual(result.iloc[1]["MMS_SALES"], "0")
        self.assertEqual(result.iloc[1]["QTY_SOLD"], "-1.5")
        self.assertEqual(result.iloc[1]["MARGIN"], "0")
        self.assertIsInstance(result.iloc[0]["SKU_CODE"], str)

    def test_rejects_empty_or_header_only_file(self):
        frame = pd.DataFrame(columns=EXPECTED_COLUMNS)
        with self.assertRaisesRegex(SchemaMismatchError, "no data rows"):
            validate_and_normalize_mms_frame(frame)

    def test_requires_exact_headers_and_order(self):
        reordered = EXPECTED_COLUMNS.copy()
        reordered[0], reordered[1] = reordered[1], reordered[0]
        with self.assertRaisesRegex(SchemaMismatchError, "Expected order"):
            validate_and_normalize_mms_frame(
                pd.DataFrame([valid_row()], columns=reordered)
            )

        missing = valid_row()
        missing.pop("MARGIN")
        with self.assertRaisesRegex(SchemaMismatchError, "Missing"):
            validate_and_normalize_mms_frame(pd.DataFrame([missing]))

        extra = valid_row(UNKNOWN="value")
        with self.assertRaisesRegex(SchemaMismatchError, "Extra"):
            validate_and_normalize_mms_frame(pd.DataFrame([extra]))

        duplicate_header_frame = pd.DataFrame(
            [["x"] * len(EXPECTED_COLUMNS)],
            columns=EXPECTED_COLUMNS[:-1] + ["DATE"],
        )
        with self.assertRaisesRegex(SchemaMismatchError, "Duplicate"):
            validate_and_normalize_mms_frame(duplicate_header_frame)

    def test_rejects_blanks_in_required_source_columns(self):
        self.assertEqual(len(REQUIRED_VALUE_COLUMNS), 8)
        for column in REQUIRED_VALUE_COLUMNS:
            with self.subTest(column=column):
                row = valid_row(**{column: "  "})
                with self.assertRaisesRegex(SchemaMismatchError, "Required"):
                    validate_and_normalize_mms_frame(
                        pd.DataFrame([row], columns=EXPECTED_COLUMNS)
                    )

        null_row = valid_row()
        null_row["SKU CODE"] = None
        with self.assertRaisesRegex(SchemaMismatchError, "Required"):
            validate_and_normalize_mms_frame(
                pd.DataFrame([null_row], columns=EXPECTED_COLUMNS)
            )

    def test_accepts_blank_optional_values_and_normalizes_them_to_empty_strings(self):
        self.assertEqual(
            OPTIONAL_VALUE_COLUMNS,
            ["STORE CATEGORIZATION", "TRANSACTION TYPE"],
        )
        cases = [
            {"STORE CATEGORIZATION": "", "TRANSACTION TYPE": "REGULAR SALE"},
            {"STORE CATEGORIZATION": "SUPERMARKET", "TRANSACTION TYPE": ""},
            {"STORE CATEGORIZATION": "", "TRANSACTION TYPE": ""},
            {"STORE CATEGORIZATION": float("nan"), "TRANSACTION TYPE": "   "},
            {"STORE CATEGORIZATION": "\t", "TRANSACTION TYPE": None},
        ]

        for index, optional_values in enumerate(cases):
            with self.subTest(optional_values=optional_values):
                row = valid_row(
                    **{
                        "TRANSACTION NUMBER": str(9000 + index),
                        **optional_values,
                    }
                )
                result = validate_and_normalize_mms_frame(
                    pd.DataFrame([row], columns=EXPECTED_COLUMNS)
                )
                expected_store_category = (
                    "SUPERMARKET"
                    if optional_values["STORE CATEGORIZATION"] == "SUPERMARKET"
                    else ""
                )
                expected_transaction_type = (
                    "REGULAR SALE"
                    if optional_values["TRANSACTION TYPE"] == "REGULAR SALE"
                    else ""
                )
                self.assertEqual(
                    result.iloc[0]["STORE_CATEGORIZATION"], expected_store_category
                )
                self.assertEqual(
                    result.iloc[0]["TRANSACTION_TYPE"], expected_transaction_type
                )
                self.assertFalse(pd.isna(result.iloc[0]["STORE_CATEGORIZATION"]))
                self.assertFalse(pd.isna(result.iloc[0]["TRANSACTION_TYPE"]))

    def test_validates_real_yymmdd_dates(self):
        invalid_values = ["240231", "24010", "24A102", "241301"]
        for value in invalid_values:
            with self.subTest(value=value):
                with self.assertRaisesRegex(SchemaMismatchError, "YYMMDD"):
                    validate_and_normalize_mms_frame(
                        pd.DataFrame(
                            [valid_row(**{"DATE": value})],
                            columns=EXPECTED_COLUMNS,
                        )
                    )

        leap_day = valid_row(**{"DATE": "240229"})
        result = validate_and_normalize_mms_frame(
            pd.DataFrame([leap_day], columns=EXPECTED_COLUMNS)
        )
        self.assertEqual(result.iloc[0]["DATE"], "240229")

    def test_requires_one_store_and_one_calendar_month(self):
        multiple_stores = pd.DataFrame(
            [valid_row(), valid_row(**{"STORE CODE": "418"})],
            columns=EXPECTED_COLUMNS,
        )
        with self.assertRaises(InvalidMultiStoreError):
            validate_and_normalize_mms_frame(multiple_stores)

        multiple_months = pd.DataFrame(
            [valid_row(), valid_row(**{"DATE": "240201"})],
            columns=EXPECTED_COLUMNS,
        )
        with self.assertRaises(InvalidMultiMonthError):
            validate_and_normalize_mms_frame(multiple_months)

    def test_requires_finite_numeric_values(self):
        for column in ["MMS SALES", "QTY SOLD", "MARGIN"]:
            for value in ["not-a-number", "NaN", "Infinity", "-Infinity"]:
                with self.subTest(column=column, value=value):
                    with self.assertRaisesRegex(SchemaMismatchError, "finite numeric"):
                        validate_and_normalize_mms_frame(
                            pd.DataFrame(
                                [valid_row(**{column: value})],
                                columns=EXPECTED_COLUMNS,
                            )
                        )

    def test_rejects_exact_duplicates_after_normalization(self):
        duplicate = valid_row()
        whitespace_duplicate = {
            column: f"  {value}  " for column, value in duplicate.items()
        }
        frame = pd.DataFrame(
            [duplicate, whitespace_duplicate], columns=EXPECTED_COLUMNS
        )
        with self.assertRaisesRegex(SchemaMismatchError, "Exact duplicate"):
            validate_and_normalize_mms_frame(frame)

    def test_numeric_equivalents_are_duplicate_values(self):
        first = valid_row(
            **{"MMS SALES": "1.0", "QTY SOLD": "2.00", "MARGIN": "3.000"}
        )
        second = valid_row(
            **{"MMS SALES": "1.00", "QTY SOLD": "2.0", "MARGIN": "3"}
        )
        with self.assertRaisesRegex(SchemaMismatchError, "Exact duplicate"):
            validate_and_normalize_mms_frame(
                pd.DataFrame([first, second], columns=EXPECTED_COLUMNS)
            )

    def test_numeric_canonicalization_preserves_arbitrary_precision(self):
        high_precision = "1.123456789012345678901234567890123456789"
        rows = [
            valid_row(
                **{
                    "TRANSACTION NUMBER": "9001",
                    "MMS SALES": high_precision,
                    "QTY SOLD": "1",
                    "MARGIN": "-0.000",
                }
            ),
            valid_row(
                **{
                    "TRANSACTION NUMBER": "9002",
                    "MMS SALES": "1.0",
                    "QTY SOLD": "1.00",
                    "MARGIN": "1.000",
                }
            ),
        ]

        result = validate_and_normalize_mms_frame(
            pd.DataFrame(rows, columns=EXPECTED_COLUMNS)
        )

        self.assertEqual(result.iloc[0]["MMS_SALES"], high_precision)
        self.assertEqual(result.iloc[0]["MARGIN"], "0")
        self.assertEqual(result.iloc[1]["MMS_SALES"], "1")
        self.assertEqual(result.iloc[1]["QTY_SOLD"], "1")
        self.assertEqual(result.iloc[1]["MARGIN"], "1")

    def test_high_precision_values_remain_distinct_for_duplicate_detection(self):
        first = valid_row(
            **{"MMS SALES": "1.1234567890123456789012345678901"}
        )
        second = valid_row(
            **{"MMS SALES": "1.1234567890123456789012345678902"}
        )

        result = validate_and_normalize_mms_frame(
            pd.DataFrame([first, second], columns=EXPECTED_COLUMNS)
        )

        self.assertEqual(len(result), 2)
        self.assertEqual(
            result["MMS_SALES"].tolist(),
            [
                "1.1234567890123456789012345678901",
                "1.1234567890123456789012345678902",
            ],
        )

    def test_duplicate_detection_treats_blank_optional_values_as_equal(self):
        first = valid_row(
            **{"STORE CATEGORIZATION": None, "TRANSACTION TYPE": "  "}
        )
        second = valid_row(
            **{"STORE CATEGORIZATION": float("nan"), "TRANSACTION TYPE": ""}
        )
        with self.assertRaisesRegex(SchemaMismatchError, "Exact duplicate"):
            validate_and_normalize_mms_frame(
                pd.DataFrame([first, second], columns=EXPECTED_COLUMNS)
            )

    def test_rows_differing_by_an_optional_value_are_not_duplicates(self):
        blank_optional = valid_row(**{"TRANSACTION TYPE": ""})
        populated_optional = valid_row(**{"TRANSACTION TYPE": "REGULAR SALE"})

        result = validate_and_normalize_mms_frame(
            pd.DataFrame(
                [blank_optional, populated_optional], columns=EXPECTED_COLUMNS
            )
        )

        self.assertEqual(len(result), 2)
        self.assertEqual(result.iloc[0]["TRANSACTION_TYPE"], "")
        self.assertEqual(result.iloc[1]["TRANSACTION_TYPE"], "REGULAR SALE")


if __name__ == "__main__":
    unittest.main()
