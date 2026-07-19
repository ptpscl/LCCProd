from __future__ import annotations

from datetime import datetime
import re

import pandas as pd

EXPECTED_COLUMNS = [
    "CUSTOMER NUMBER",
    "GENDER",
    "BIRTHDAY",
    "AGE",
    "CITY",
    "PROVINCE",
    "EXPIRY DATE",
    "MEMBER LOCATION",
    "APPLICATION DATE",
    "MEMBER SINCE",
    "LAST VISIT",
    "FREQUENCY OF VISIT",
    "LAST VISITED STORE",
]

DATE_COLUMNS = [
    "BIRTHDAY",
    "EXPIRY DATE",
    "APPLICATION DATE",
    "MEMBER SINCE",
    "LAST VISIT",
]

INTEGER_COLUMNS = ["AGE", "FREQUENCY OF VISIT"]


class CustomerValidationError(ValueError):
    """Raised when an uploaded Customer file violates the domain schema."""


def _is_blank(value: object) -> bool:
    return pd.isna(value) or str(value).strip() == ""


def validate_and_cast_customer_frame(frame: pd.DataFrame) -> pd.DataFrame:
    """Validate a raw Customer frame and return values ready for Supabase."""
    clean = frame.copy()
    clean.columns = [str(column).lstrip("\ufeff").strip().upper() for column in frame.columns]

    duplicate_columns = clean.columns[clean.columns.duplicated()].unique().tolist()
    missing_columns = [column for column in EXPECTED_COLUMNS if column not in clean.columns]
    extra_columns = [column for column in clean.columns if column not in EXPECTED_COLUMNS]
    if missing_columns or extra_columns or duplicate_columns:
        raise CustomerValidationError(
            "Schema mismatch. "
            f"Missing: {missing_columns}; Extra: {extra_columns}; Duplicate: {duplicate_columns}"
        )

    clean = clean[EXPECTED_COLUMNS]
    if clean.empty:
        raise CustomerValidationError("Customer file contains no data rows")

    customer_numbers = clean["CUSTOMER NUMBER"].fillna("").astype(str).str.strip()
    blank_rows = (customer_numbers[customer_numbers == ""].index + 2).tolist()
    if blank_rows:
        raise CustomerValidationError(
            f"CUSTOMER NUMBER is required; invalid CSV rows: {blank_rows[:10]}"
        )

    clean["CUSTOMER NUMBER"] = customer_numbers.str.upper()

    for column in DATE_COLUMNS:
        cast_values: list[str | None] = []
        invalid_values: list[str] = []
        for raw_value in clean[column]:
            if _is_blank(raw_value):
                cast_values.append(None)
                continue
            value = str(raw_value).strip()
            try:
                parsed = datetime.strptime(value, "%Y%m%d").date()
                cast_values.append(parsed.isoformat())
            except ValueError:
                invalid_values.append(value)
                cast_values.append(None)
        if invalid_values:
            raise CustomerValidationError(
                f"{column} must contain valid YYYYMMDD dates; invalid values: {invalid_values[:5]}"
            )
        clean[column] = pd.Series(cast_values, index=clean.index, dtype=object)

    for column in INTEGER_COLUMNS:
        cast_values: list[int | None] = []
        invalid_values: list[str] = []
        for raw_value in clean[column]:
            if _is_blank(raw_value):
                cast_values.append(None)
                continue
            value = str(raw_value).strip()
            if not re.fullmatch(r"\d+", value):
                invalid_values.append(value)
                cast_values.append(None)
            else:
                cast_values.append(int(value))
        if invalid_values:
            raise CustomerValidationError(
                f"{column} must contain non-negative whole numbers; invalid values: {invalid_values[:5]}"
            )
        clean[column] = pd.Series(cast_values, index=clean.index, dtype=object)

    for column in EXPECTED_COLUMNS:
        if column in DATE_COLUMNS or column in INTEGER_COLUMNS or column == "CUSTOMER NUMBER":
            continue
        clean[column] = clean[column].map(
            lambda value: None if _is_blank(value) else str(value).strip()
        )

    identical_duplicates = clean.duplicated(subset=EXPECTED_COLUMNS, keep=False)
    if identical_duplicates.any():
        duplicate_rows = (clean.index[identical_duplicates] + 2).tolist()
        raise CustomerValidationError(
            "Fully identical Customer rows are not allowed; "
            f"duplicate CSV rows: {duplicate_rows[:10]}"
        )

    return clean
