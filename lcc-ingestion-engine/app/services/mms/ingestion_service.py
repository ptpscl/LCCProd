from __future__ import annotations

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


def _source_text(value: object) -> str | None:
    """Return a JSON-safe source value without changing nonempty text."""
    if pd.isna(value) or value == "":
        return None
    return str(value)


def _detect_store_code(values: pd.Series) -> str | None:
    detected: list[str] = []
    for value in values:
        if _is_blank(value):
            continue
        store_code = str(value).strip()
        if store_code not in detected:
            detected.append(store_code)

    if len(detected) > 1:
        raise InvalidMultiStoreError(
            "File contains multiple populated stores "
            f"({detected}). Each file may contain at most one populated store."
        )
    return detected[0] if detected else None


def _metadata_year_month(value: object) -> str | None:
    if _is_blank(value):
        return None
    source_date = str(value).strip()
    if not re.fullmatch(r"\d{6}", source_date):
        return None
    month = int(source_date[2:4])
    if not 1 <= month <= 12:
        return None
    return f"20{source_date[:2]}-{source_date[2:4]}"


def _detect_year_month(values: pd.Series) -> str | None:
    detected: list[str] = []
    for value in values:
        year_month = _metadata_year_month(value)
        if year_month is not None and year_month not in detected:
            detected.append(year_month)

    if len(detected) > 1:
        raise InvalidMultiMonthError(
            "File contains multiple detected calendar months "
            f"({detected}). Each file may contain at most one detected month."
        )
    return detected[0] if detected else None


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
        mapped = clean[column].map(_source_text)
        clean[column] = mapped.astype(object).where(mapped.notna(), None)

    store_code = _detect_store_code(clean["STORE CODE"])
    year_month = _detect_year_month(clean["DATE"])

    clean = clean[EXPECTED_COLUMNS]
    clean.columns = DATABASE_COLUMNS
    clean.attrs["store_code"] = store_code
    clean.attrs["year_month"] = year_month
    return clean


def ingest_batch(batch_id: str) -> dict:
    logger.info("Starting MMS ingestion for batch %s", batch_id)
    batch = get_batch(batch_id)
    if not batch:
        raise BatchNotFoundError(f"MMS batch {batch_id} not found")

    existing_row_count = count_rows_for_batch(batch_id)
    stored_row_count = batch.get("row_count")
    if (
        batch.get("status") == "ingested"
        and stored_row_count is not None
        and stored_row_count == existing_row_count
    ):
        return {
            "batch_id": batch_id,
            "rows_ingested": 0,
            "status": "already_ingested",
        }

    if existing_row_count:
        try:
            delete_rows_for_batch(batch_id)
            remaining_row_count = count_rows_for_batch(batch_id)
            if remaining_row_count:
                raise RuntimeError(
                    "Partial MMS rows remain after batch-specific cleanup"
                )
        except Exception as exc:
            logger.exception(
                "Could not clean up partial MMS rows before retrying batch %s",
                batch_id,
            )
            try:
                update_batch(batch_id, None, "ingestion_failed")
            except Exception:
                logger.exception(
                    "Could not mark MMS batch %s as ingestion_failed after "
                    "partial-row cleanup failure",
                    batch_id,
                )
            raise RuntimeError(
                "Could not safely clean up partial MMS rows before retry"
            ) from exc

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

    store_code = clean_frame.attrs["store_code"]
    year_month = clean_frame.attrs["year_month"]
    update_batch_meta(batch_id, store_code, year_month)

    existing_batch_id = None
    if store_code is not None and year_month is not None:
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
