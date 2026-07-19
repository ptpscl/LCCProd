from __future__ import annotations

import logging
import sqlite3
import tempfile
from pathlib import Path

import pandas as pd

from app.services.customer.customer_schema import (
    CustomerValidationError,
    EXPECTED_COLUMNS,
    iter_customer_csv_chunks,
    to_json_safe_records,
    validate_and_cast_customer_frame,
)
from app.services.customer.supabase_service import (
    count_rows_for_batch,
    delete_rows_for_batch,
    download_batch_file_to_path,
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
    if existing_row_count and batch.get("status") == "ingested":
        update_batch(batch_id, "ingested", existing_row_count)
        return {
            "batch_id": batch_id,
            "status": "already_ingested",
            "rows_ingested": 0,
            "row_count": existing_row_count,
        }
    if existing_row_count:
        logger.warning(
            "Removing %s partial rows before retrying Customer batch %s",
            existing_row_count,
            batch_id,
        )
        delete_rows_for_batch(batch_id)

    file_path = batch.get("file_path")
    if not file_path:
        update_batch(batch_id, "validation_failed")
        raise CustomerValidationError("Batch has no file_path")

    update_batch(batch_id, "processing")
    rows_inserted = 0
    try:
        with tempfile.TemporaryDirectory(prefix="customer-ingest-") as temp_dir:
            csv_path = Path(temp_dir) / "source.csv"
            hashes_path = Path(temp_dir) / "row-hashes.sqlite3"
            download_batch_file_to_path(file_path, csv_path)

            with sqlite3.connect(hashes_path) as hash_db:
                hash_db.execute("CREATE TABLE row_hashes (hash TEXT PRIMARY KEY)")
                chunks, detected_encoding = iter_customer_csv_chunks(csv_path)
                logger.info(
                    "Processing Customer batch %s using %s encoding",
                    batch_id,
                    detected_encoding,
                )
                for raw_frame in chunks:
                    clean_frame = validate_and_cast_customer_frame(raw_frame)
                    row_hashes = pd.util.hash_pandas_object(
                        clean_frame[EXPECTED_COLUMNS],
                        index=False,
                    ).astype("uint64").tolist()
                    for position, row_hash in enumerate(row_hashes):
                        try:
                            hash_db.execute(
                                "INSERT INTO row_hashes(hash) VALUES (?)",
                                (f"{int(row_hash):016x}",),
                            )
                        except sqlite3.IntegrityError as exc:
                            csv_row = int(clean_frame.index[position]) + 2
                            raise CustomerValidationError(
                                "Fully identical Customer rows are not allowed; "
                                f"duplicate CSV row: {csv_row}"
                            ) from exc
                    hash_db.commit()

                    clean_frame["source_batch_id"] = batch_id
                    records = to_json_safe_records(clean_frame)
                    insert_customer_rows(records)
                    rows_inserted += len(records)
                    logger.info(
                        "Inserted %s Customer rows for batch %s",
                        rows_inserted,
                        batch_id,
                    )
        if rows_inserted == 0:
            raise CustomerValidationError("Customer file contains no data rows")
    except CustomerValidationError:
        if rows_inserted:
            delete_rows_for_batch(batch_id)
        update_batch(batch_id, "validation_failed")
        raise
    except Exception as exc:
        logger.exception("Customer processing failed for batch %s", batch_id)
        try:
            delete_rows_for_batch(batch_id)
        except Exception:
            logger.exception("Customer rollback failed for batch %s", batch_id)
        update_batch(batch_id, "ingestion_failed")
        raise RuntimeError(f"Customer processing failed: {exc}") from exc

    update_batch(batch_id, "ingested", rows_inserted)
    return {
        "batch_id": batch_id,
        "status": "ingested",
        "rows_ingested": rows_inserted,
        "row_count": rows_inserted,
    }
