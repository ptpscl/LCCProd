from __future__ import annotations

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

    for column in EXPECTED_COLUMNS:
        if column == "CUSTOMER NUMBER":
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


def to_json_safe_records(frame: pd.DataFrame) -> list[dict]:
    """Convert a validated frame to records without NaN/NaT/NumPy scalars."""
    records: list[dict] = []
    for raw_record in frame.to_dict(orient="records"):
        record: dict = {}
        for key, value in raw_record.items():
            if pd.isna(value):
                record[key] = None
            elif hasattr(value, "item"):
                record[key] = value.item()
            else:
                record[key] = value
        records.append(record)
    return records
