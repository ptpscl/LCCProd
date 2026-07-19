from __future__ import annotations

import logging

from app.services.customer.customer_schema import (
    CustomerValidationError,
    read_customer_csv,
    to_json_safe_records,
    validate_and_cast_customer_frame,
)
from app.services.customer.supabase_service import (
    count_rows_for_batch,
    delete_rows_for_batch,
    download_batch_file,
    get_batch,
    insert_customer_rows,
    update_batch,
)

logger = logging.getLogger(__name__)


class CustomerBatchNotFoundError(LookupError):
    pass


def ingest_batch(batch_id: str) -> dict:
    batch = get_batch(batch_id)
    if not batch:
        raise CustomerBatchNotFoundError(f"Customer batch {batch_id} not found")

    existing_row_count = count_rows_for_batch(batch_id)
    if existing_row_count:
        update_batch(batch_id, "ingested", existing_row_count)
        return {
            "batch_id": batch_id,
            "status": "already_ingested",
            "rows_ingested": 0,
            "row_count": existing_row_count,
        }

    file_path = batch.get("file_path")
    if not file_path:
        update_batch(batch_id, "validation_failed")
        raise CustomerValidationError("Batch has no file_path")

    update_batch(batch_id, "processing")
    try:
        file_bytes = download_batch_file(file_path)
    except Exception as exc:
        update_batch(batch_id, "ingestion_failed")
        raise RuntimeError(f"Customer file download failed: {exc}") from exc

    try:
        raw_frame, detected_encoding = read_customer_csv(file_bytes)
        logger.info(
            "Parsed Customer batch %s using %s encoding",
            batch_id,
            detected_encoding,
        )
        clean_frame = validate_and_cast_customer_frame(raw_frame)
        clean_frame["source_batch_id"] = batch_id
        records = to_json_safe_records(clean_frame)
    except CustomerValidationError:
        update_batch(batch_id, "validation_failed")
        raise
    except Exception as exc:
        update_batch(batch_id, "validation_failed")
        raise CustomerValidationError(f"Could not parse Customer CSV/TSV: {exc}") from exc

    try:
        insert_customer_rows(records)
    except Exception as exc:
        logger.exception("Customer insertion failed for batch %s", batch_id)
        try:
            delete_rows_for_batch(batch_id)
        except Exception:
            logger.exception("Customer rollback failed for batch %s", batch_id)
        update_batch(batch_id, "ingestion_failed")
        raise RuntimeError(f"Customer insertion failed: {exc}") from exc

    update_batch(batch_id, "ingested", len(records))
    return {
        "batch_id": batch_id,
        "status": "ingested",
        "rows_ingested": len(records),
        "row_count": len(records),
    }
