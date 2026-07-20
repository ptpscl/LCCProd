import unittest

import pandas as pd

from app.services.mms.ingestion_service import (
    DATABASE_COLUMNS,
    EXPECTED_COLUMNS,
    InvalidMultiMonthError,
    InvalidMultiStoreError,
    SchemaMismatchError,
    validate_and_normalize_mms_frame,
)


def valid_row(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
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


def validated(rows: list[dict[str, object]]) -> pd.DataFrame:
    return validate_and_normalize_mms_frame(
        pd.DataFrame(rows, columns=EXPECTED_COLUMNS)
    )


class MmsSchemaTests(unittest.TestCase):
    def test_accepts_valid_data_and_maps_bronze_columns_without_casting(self):
        result = validated(
            [
                valid_row(),
                valid_row(
                    **{
                        "TRANSACTION NUMBER": "8713",
                        "MMS SALES": "0.00",
                        "QTY SOLD": "-1.50",
                        "MARGIN": "-0.00",
                    }
                ),
            ]
        )

        self.assertEqual(result.columns.tolist(), DATABASE_COLUMNS)
        self.assertEqual(result.iloc[0]["DATE"], "240102")
        self.assertEqual(result.iloc[1]["MMS_SALES"], "0.00")
        self.assertEqual(result.iloc[1]["QTY_SOLD"], "-1.50")
        self.assertEqual(result.iloc[1]["MARGIN"], "-0.00")
        self.assertEqual(result.attrs["store_code"], "417")
        self.assertEqual(result.attrs["year_month"], "2024-01")

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

    def test_all_ten_source_fields_may_be_empty_and_become_none(self):
        result = validated([{column: "" for column in EXPECTED_COLUMNS}])

        self.assertTrue(all(dtype == object for dtype in result.dtypes))
        self.assertEqual(result.iloc[0].tolist(), [None] * len(EXPECTED_COLUMNS))
        self.assertIsNone(result.attrs["store_code"])
        self.assertIsNone(result.attrs["year_month"])

    def test_null_cells_become_none_and_nonempty_text_is_preserved_exactly(self):
        row = valid_row(
            **{
                "DATE": None,
                "TRANSACTION NUMBER": "  8712  ",
                "REGISTER NUMBER": pd.NA,
                "STORE CODE": "  417  ",
                "STORE CATEGORIZATION": "   ",
                "TRANSACTION TYPE": "\t",
                "MMS SALES": "$ 10.00 ",
            }
        )

        result = validated([row])

        self.assertIsNone(result.iloc[0]["DATE"])
        self.assertIsNone(result.iloc[0]["REGISTER_NUMBER"])
        self.assertEqual(result.iloc[0]["TRANSACTION_NUMBER"], "  8712  ")
        self.assertEqual(result.iloc[0]["STORE_CODE"], "  417  ")
        self.assertEqual(result.iloc[0]["STORE_CATEGORIZATION"], "   ")
        self.assertEqual(result.iloc[0]["TRANSACTION_TYPE"], "\t")
        self.assertEqual(result.iloc[0]["MMS_SALES"], "$ 10.00 ")
        self.assertEqual(result.attrs["store_code"], "417")
        self.assertIsNone(result.attrs["year_month"])

    def test_malformed_dates_and_arbitrary_measures_remain_unchanged(self):
        values = [
            ("240231", "unknown", "NaN", "Infinity"),
            ("not-a-date", "1e-1000", "PHP 1,234.50", "-0.000"),
            ("241301", "-25", "0", "+unusual+"),
        ]
        rows = [
            valid_row(
                **{
                    "DATE": date_value,
                    "TRANSACTION NUMBER": str(9000 + index),
                    "MMS SALES": sales,
                    "QTY SOLD": quantity,
                    "MARGIN": margin,
                }
            )
            for index, (date_value, sales, quantity, margin) in enumerate(values)
        ]

        result = validated(rows)

        self.assertEqual(result["DATE"].tolist(), [item[0] for item in values])
        self.assertEqual(result["MMS_SALES"].tolist(), [item[1] for item in values])
        self.assertEqual(result["QTY_SOLD"].tolist(), [item[2] for item in values])
        self.assertEqual(result["MARGIN"].tolist(), [item[3] for item in values])
        self.assertEqual(result.attrs["year_month"], "2024-02")

    def test_high_precision_and_numeric_looking_text_preserve_source_spelling(self):
        high_precision = "10.123456789012345678901234567890"
        result = validated(
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

        self.assertEqual(result.iloc[0]["MMS_SALES"], high_precision)
        self.assertEqual(result.iloc[0]["QTY_SOLD"], "1.00")
        self.assertEqual(result.iloc[0]["MARGIN"], "-0.000")

    def test_identical_rows_are_preserved(self):
        duplicate = valid_row()
        result = validated([duplicate, duplicate.copy()])

        self.assertEqual(len(result), 2)
        self.assertEqual(result.iloc[0].to_dict(), result.iloc[1].to_dict())

    def test_one_trimmed_store_plus_blank_stores_succeeds(self):
        rows = [
            valid_row(**{"TRANSACTION NUMBER": "1", "STORE CODE": "  store1  "}),
            valid_row(**{"TRANSACTION NUMBER": "2", "STORE CODE": ""}),
            valid_row(**{"TRANSACTION NUMBER": "3", "STORE CODE": "   "}),
            valid_row(**{"TRANSACTION NUMBER": "4", "STORE CODE": None}),
        ]

        result = validated(rows)

        self.assertEqual(result.attrs["store_code"], "store1")
        self.assertEqual(result["STORE_CODE"].tolist(), ["  store1  ", None, "   ", None])

    def test_all_blank_stores_succeed_with_null_metadata(self):
        rows = [
            valid_row(**{"TRANSACTION NUMBER": "1", "STORE CODE": ""}),
            valid_row(**{"TRANSACTION NUMBER": "2", "STORE CODE": "  "}),
            valid_row(**{"TRANSACTION NUMBER": "3", "STORE CODE": None}),
        ]

        result = validated(rows)

        self.assertIsNone(result.attrs["store_code"])

    def test_two_trimmed_case_sensitive_stores_reject(self):
        cases = [(" store1 ", "store2"), ("store1", "STORE1")]
        for first, second in cases:
            with self.subTest(first=first, second=second):
                with self.assertRaises(InvalidMultiStoreError):
                    validated(
                        [
                            valid_row(**{"TRANSACTION NUMBER": "1", "STORE CODE": first}),
                            valid_row(**{"TRANSACTION NUMBER": "2", "STORE CODE": second}),
                        ]
                    )

    def test_one_usable_month_ignores_unusable_dates(self):
        source_dates: list[object] = ["240231", "not-a-date", "241301", "", "   ", None]
        rows = [
            valid_row(**{"TRANSACTION NUMBER": str(index), "DATE": value})
            for index, value in enumerate(source_dates)
        ]

        result = validated(rows)

        self.assertEqual(result.attrs["year_month"], "2024-02")
        self.assertEqual(result["DATE"].tolist(), ["240231", "not-a-date", "241301", None, "   ", None])

    def test_no_usable_month_succeeds_with_null_metadata(self):
        source_dates: list[object] = ["not-a-date", "241301", "24010", "", None]
        rows = [
            valid_row(**{"TRANSACTION NUMBER": str(index), "DATE": value})
            for index, value in enumerate(source_dates)
        ]

        result = validated(rows)

        self.assertIsNone(result.attrs["year_month"])

    def test_two_detected_months_reject(self):
        with self.assertRaises(InvalidMultiMonthError):
            validated(
                [
                    valid_row(**{"TRANSACTION NUMBER": "1", "DATE": "240231"}),
                    valid_row(**{"TRANSACTION NUMBER": "2", "DATE": "240301"}),
                ]
            )


if __name__ == "__main__":
    unittest.main()
