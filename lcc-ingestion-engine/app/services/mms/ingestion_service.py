from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation
import io
import logging
import re

import pandas as pd

from app.services.mms.supabase_service import (
    check_existing_ingested_batch,
    count_rows_for_batch,
    delete_rows_for_batch,
    download_batch_file,
    get_batch,
    insert_mms_rows,
    update_batch,
    update_batch_meta,
)

logger = logging.getLogger(__name__)

EXPECTED_COLUMNS = [
    "DATE",
    "TRANSACTION NUMBER",
    "REGISTER NUMBER",
    "STORE CODE",
    "STORE CATEGORIZATION",
    "SKU CODE",
    "TRANSACTION TYPE",
    "MMS SALES",
    "QTY SOLD",
    "MARGIN",
]

NUMERIC_COLUMNS = ["MMS SALES", "QTY SOLD", "MARGIN"]
OPTIONAL_VALUE_COLUMNS = ["STORE CATEGORIZATION", "TRANSACTION TYPE"]
REQUIRED_VALUE_COLUMNS = [
    column for column in EXPECTED_COLUMNS if column not in OPTIONAL_VALUE_COLUMNS
]
DATABASE_COLUMNS = [column.replace(" ", "_") for column in EXPECTED_COLUMNS]


class BatchNotFoundError(LookupError):
    pass


class SchemaMismatchError(ValueError):
    pass


class InvalidMultiStoreError(SchemaMismatchError):
    pass


class InvalidMultiMonthError(SchemaMismatchError):
    pass


def _is_blank(value: object) -> bool:
    return pd.isna(value) or str(value).strip() == ""


def _normalize_decimal(value: object, column: str, csv_row: int) -> str:
    try:
        number = Decimal(str(value).strip())
    except (InvalidOperation, ValueError) as exc:
        raise SchemaMismatchError(
            f"{column} must contain finite numeric values; invalid CSV row: {csv_row}"
        ) from exc

    if not number.is_finite():
        raise SchemaMismatchError(
            f"{column} must contain finite numeric values; invalid CSV row: {csv_row}"
        )

    if number == 0:
        return "0"

    canonical = format(number, "f")
    if "." not in canonical:
        return canonical

    integer_part, fractional_part = canonical.split(".", 1)
    fractional_part = fractional_part.rstrip("0")
    if not fractional_part:
        return integer_part
    return f"{integer_part}.{fractional_part}"


def _parse_source_date(value: str, csv_row: int) -> tuple[str, str]:
    if not re.fullmatch(r"\d{6}", value):
        raise SchemaMismatchError(
            f"DATE must contain valid YYMMDD dates; invalid CSV row: {csv_row}"
        )

    year = 2000 + int(value[0:2])
    month = int(value[2:4])
    day = int(value[4:6])
    try:
        parsed = date(year, month, day)
    except ValueError as exc:
        raise SchemaMismatchError(
            f"DATE must contain valid YYMMDD dates; invalid CSV row: {csv_row}"
        ) from exc
    return value, parsed.strftime("%Y-%m")


def validate_and_normalize_mms_frame(frame: pd.DataFrame) -> pd.DataFrame:
    """Validate a raw MMS frame and return Bronze-ready underscore columns."""
    actual_columns = [str(column).lstrip("\ufeff") for column in frame.columns]
    duplicate_columns = sorted(
        {column for column in actual_columns if actual_columns.count(column) > 1}
    )
    missing_columns = [
        column for column in EXPECTED_COLUMNS if column not in actual_columns
    ]
    extra_columns = [
        column for column in actual_columns if column not in EXPECTED_COLUMNS
    ]

    if actual_columns != EXPECTED_COLUMNS:
        details = (
            f"Missing: {missing_columns}; Extra: {extra_columns}; "
            f"Duplicate: {duplicate_columns}; Expected order: {EXPECTED_COLUMNS}"
        )
        raise SchemaMismatchError(f"Schema mismatch. {details}")

    clean = frame.copy()
    clean.columns = actual_columns
    if clean.empty:
        raise SchemaMismatchError("MMS file contains no data rows")

    for column in EXPECTED_COLUMNS:
        if column in OPTIONAL_VALUE_COLUMNS:
            clean[column] = clean[column].map(
                lambda value: "" if _is_blank(value) else str(value).strip()
            )
        else:
            clean[column] = clean[column].map(
                lambda value: value if pd.isna(value) else str(value).strip()
            )

    blank_locations: list[str] = []
    for column in REQUIRED_VALUE_COLUMNS:
        blank_indices = clean.index[clean[column].map(_is_blank)].tolist()
        blank_locations.extend(
            f"row {index + 2} ({column})" for index in blank_indices[:10]
        )
    if blank_locations:
        raise SchemaMismatchError(
            "Required MMS source values are blank at "
            + ", ".join(blank_locations[:10])
        )

    year_months: list[str] = []
    normalized_dates: list[str] = []
    for index, raw_value in clean["DATE"].items():
        normalized_date, year_month = _parse_source_date(
            str(raw_value), int(index) + 2
        )
        normalized_dates.append(normalized_date)
        year_months.append(year_month)
    clean["DATE"] = normalized_dates

    distinct_stores = clean["STORE CODE"].unique().tolist()
    if len(distinct_stores) != 1:
        raise InvalidMultiStoreError(
            "File contains multiple stores "
            f"({distinct_stores}). Each file must contain exactly one store."
        )

    distinct_months = list(dict.fromkeys(year_months))
    if len(distinct_months) != 1:
        raise InvalidMultiMonthError(
            "File contains multiple calendar months "
            f"({distinct_months}). Each file must contain exactly one month."
        )

    for column in NUMERIC_COLUMNS:
        clean[column] = [
            _normalize_decimal(value, column, int(index) + 2)
            for index, value in clean[column].items()
        ]

    duplicate_mask = clean.duplicated(subset=EXPECTED_COLUMNS, keep=False)
    if duplicate_mask.any():
        duplicate_rows = (clean.index[duplicate_mask] + 2).tolist()
        duplicate_groups = clean.loc[duplicate_mask, EXPECTED_COLUMNS].drop_duplicates()
        raise SchemaMismatchError(
            "Exact duplicate MMS rows found after normalization: "
            f"{int(duplicate_mask.sum())} rows in {len(duplicate_groups)} groups; "
            f"CSV rows: {duplicate_rows[:10]}. No rows were inserted."
        )

    clean = clean[EXPECTED_COLUMNS]
    clean.columns = DATABASE_COLUMNS
    return clean


def ingest_batch(batch_id: str) -> dict:
    logger.info("Starting MMS ingestion for batch %s", batch_id)
    batch = get_batch(batch_id)
    if not batch:
        raise BatchNotFoundError(f"MMS batch {batch_id} not found")

    file_path_value = batch.get("file_path")
    file_path = str(file_path_value).strip() if file_path_value is not None else ""
    if not file_path:
        update_batch(batch_id, None, "ingestion_failed")
        raise SchemaMismatchError(f"MMS batch {batch_id} has no file_path")

    try:
        file_bytes = download_batch_file(file_path)
    except Exception as exc:
        update_batch(batch_id, None, "ingestion_failed")
        raise RuntimeError(f"MMS file download failed: {exc}") from exc

    try:
        raw_frame = pd.read_csv(
            io.BytesIO(file_bytes),
            dtype=str,
            encoding="utf-8-sig",
            keep_default_na=False,
        )
        clean_frame = validate_and_normalize_mms_frame(raw_frame)
    except InvalidMultiStoreError:
        update_batch(batch_id, None, "invalid_multi_store")
        raise
    except InvalidMultiMonthError:
        update_batch(batch_id, None, "invalid_multi_month")
        raise
    except SchemaMismatchError:
        update_batch(batch_id, None, "ingestion_failed")
        raise
    except Exception as exc:
        update_batch(batch_id, None, "ingestion_failed")
        raise SchemaMismatchError(f"Could not parse MMS CSV: {exc}") from exc

    store_code = str(clean_frame.iloc[0]["STORE_CODE"])
    source_date = str(clean_frame.iloc[0]["DATE"])
    year_month = f"20{source_date[:2]}-{source_date[2:4]}"
    update_batch_meta(batch_id, store_code, year_month)

    existing_batch_id = check_existing_ingested_batch(
        batch_id, store_code, year_month
    )
    if existing_batch_id:
        update_batch(batch_id, None, "duplicate_suspected")
        return {
            "batch_id": batch_id,
            "status": "duplicate_suspected",
            "existing_batch_id": existing_batch_id,
            "store_code": store_code,
            "year_month": year_month,
            "rows_ingested": 0,
        }

    existing_row_count = count_rows_for_batch(batch_id)
    if existing_row_count:
        return {
            "batch_id": batch_id,
            "rows_ingested": 0,
            "status": "already_ingested",
        }

    clean_frame["source_batch_id"] = batch_id
    records = clean_frame.to_dict(orient="records")

    try:
        insert_mms_rows(records, chunk_size=5_000)
    except Exception as exc:
        logger.exception("MMS insertion failed for batch %s", batch_id)
        try:
            delete_rows_for_batch(batch_id)
        except Exception:
            logger.exception("MMS rollback failed for batch %s", batch_id)
        update_batch(batch_id, None, "ingestion_failed")
        raise RuntimeError(f"MMS insertion failed: {exc}") from exc

    update_batch(batch_id, len(records), "ingested")
    return {
        "batch_id": batch_id,
        "rows_ingested": len(records),
        "status": "ingested",
    }
