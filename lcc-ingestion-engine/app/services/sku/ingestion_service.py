import io
import logging
import pandas as pd
import numpy as np
from app.services.sku.supabase_service import (
    get_batch, download_file, update_batch, get_client
)

logger = logging.getLogger(__name__)

class BatchNotFoundError(Exception):
    pass

class SchemaMismatchError(Exception):
    pass

EXPECTED_COLUMNS = [
    "SKU CODE", "SKU DESCRIPTION", "DIVISION", "DEPARTMENT", "CATEGORY",
    "CLASS", "BRAND", "STANDARD PACK", "PACK TYPE", "BUY UNIT OF MEASURE",
    "SELL UNIT OF MEASURE", "UNIT COST", "WEIGTH", "HEIGHT", "LENGTH",
    "WIDTH", "CUBE", "VENDOR CODE", "VENDOR DESCRIPTION"
]

def ingest_batch(batch_id: str) -> dict:
    logger.info(f"Starting SKU ingestion for batch {batch_id}")
    batch = get_batch(batch_id)
    if not batch:
        logger.error(f"Batch {batch_id} not found")
        raise BatchNotFoundError(f"Batch {batch_id} not found")

    file_path = batch.get("file_path")
    if not file_path:
        raise RuntimeError(f"Batch {batch_id} has no file_path")

    try:
        logger.info(f"Downloading file {file_path} for batch {batch_id}")
        csv_bytes = download_file('bronze-raw', file_path)
    except Exception as e:
        update_batch(batch_id, None, "ingestion_failed")
        raise RuntimeError(f"Failed to download file for batch {batch_id}: {e}")

    try:
        logger.info(f"Parsing CSV for batch {batch_id}")
        df = pd.read_csv(io.BytesIO(csv_bytes), dtype=str)
    except Exception as e:
        update_batch(batch_id, None, 'ingestion_failed')
        raise SchemaMismatchError(f"Failed to parse CSV: {e}")
    file_row_count = len(df)

    df.columns = [str(c).strip().upper() for c in df.columns]

    missing_cols = [col for col in EXPECTED_COLUMNS if col not in df.columns]
    if missing_cols:
        update_batch(batch_id, None, 'ingestion_failed')
        raise SchemaMismatchError(f"Schema mismatch. Missing columns: {missing_cols}")

    # WITHIN-FILE DUPLICATE GUARD: exact duplicates across all columns
    before = len(df)
    df = df.drop_duplicates(subset=EXPECTED_COLUMNS, keep="first")
    within_file_dupes = before - len(df)
    if within_file_dupes > 0:
        logger.warning(f"Batch {batch_id}: dropped {within_file_dupes} exact duplicate rows within the file")

    df = df[EXPECTED_COLUMNS]
    df.columns = [c.replace(' ', '_') for c in df.columns]
    df["source_batch_id"] = batch_id

    # Replace NaN/NaT with None so it translates to SQL NULL
    df = df.replace({np.nan: None})

    records = df.to_dict(orient="records")
    total_rows = len(records)
    logger.info(f"Parsed {total_rows} total rows for batch {batch_id}")
    chunk_size = 5000

    client = get_client()

    try:
        logger.info(f"Running idempotency check for batch {batch_id}")
        existing_rows_response = client.table('bronze_sku_hierarchy').select('id', count='exact').eq('source_batch_id', batch_id).limit(1).execute()
        if existing_rows_response.count is not None and existing_rows_response.count > 0:
            logger.info(f"Batch {batch_id} is already ingested (idempotency check passed).")
            return {
                "batch_id": batch_id,
                "rows_ingested": 0,
                "status": "already_ingested"
            }

        rows_inserted = 0
        for i in range(0, total_rows, chunk_size):
            chunk = records[i:i + chunk_size]
            resp = client.table('bronze_sku_hierarchy').upsert(
                chunk, on_conflict='row_hash', ignore_duplicates=True
            ).execute()
            rows_inserted += len(resp.data or [])
            logger.info(f"Chunk {i // chunk_size + 1} for batch {batch_id}: {rows_inserted} new rows so far")

    except Exception as e:
        logger.error(f"Database insertion failed for batch {batch_id}: {e}. Rolling back partial inserts.")
        try:
            client.table('bronze_sku_hierarchy').delete().eq('source_batch_id', batch_id).execute()
            logger.info(f"Rollback successful for batch {batch_id}")
        except Exception as rollback_err:
            logger.error(f"Rollback failed for batch {batch_id}: {rollback_err}")

        update_batch(batch_id, None, 'ingestion_failed')
        raise RuntimeError(f"Database insertion failed: {e}")

    duplicates_skipped = (total_rows - rows_inserted) + within_file_dupes
    logger.info(f"Batch {batch_id}: {rows_inserted} new rows, {duplicates_skipped} duplicates skipped")
    update_batch(batch_id, rows_inserted, 'ingested',
                 file_row_count=file_row_count,
                 duplicates_skipped=duplicates_skipped)

    return {
        "batch_id": batch_id,
        "rows_ingested": rows_inserted,
        "duplicates_skipped": duplicates_skipped,
        "within_file_duplicates_dropped": within_file_dupes,
        "status": "ingested"
    }
