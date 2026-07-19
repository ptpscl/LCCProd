from __future__ import annotations

import codecs
import io

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


def detect_customer_encoding(file_bytes: bytes) -> str:
    """Validate bytes incrementally and return the first supported encoding."""
    decoding_errors: list[str] = []
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            decoder = codecs.getincrementaldecoder(encoding)(errors="strict")
            for start in range(0, len(file_bytes), 1024 * 1024):
                decoder.decode(file_bytes[start:start + 1024 * 1024], final=False)
            decoder.decode(b"", final=True)
            return encoding
        except UnicodeDecodeError as exc:
            decoding_errors.append(f"{encoding}: {exc}")

    raise CustomerValidationError(
        "Customer file encoding is unsupported. " + " | ".join(decoding_errors)
    )


def read_customer_csv(file_bytes: bytes) -> tuple[pd.DataFrame, str]:
    """Read a complete Customer file. Intended for tests and smaller files."""
    encoding = detect_customer_encoding(file_bytes)
    frame = pd.read_csv(
        io.BytesIO(file_bytes),
        sep=None,
        engine="python",
        dtype=str,
        encoding=encoding,
    )
    return frame, encoding


def iter_customer_csv_chunks(file_bytes: bytes, chunk_size: int = 5_000):
    """Return a bounded-memory Customer CSV reader and detected encoding."""
    encoding = detect_customer_encoding(file_bytes)
    reader = pd.read_csv(
        io.BytesIO(file_bytes),
        sep=None,
        engine="python",
        dtype=str,
        encoding=encoding,
        chunksize=chunk_size,
    )
    return reader, encoding


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
