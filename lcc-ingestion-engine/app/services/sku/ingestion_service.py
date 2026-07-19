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

    df.columns = [str(c).strip().upper() for c in df.columns]

    missing_cols = [col for col in EXPECTED_COLUMNS if col not in df.columns]
    if missing_cols:
        update_batch(batch_id, None, 'ingestion_failed')
        raise SchemaMismatchError(f"Schema mismatch. Missing columns: {missing_cols}")

    # DUPLICATE SKU GUARD (within file): SKU CODE is the natural key
    dupes = int(df["SKU CODE"].dropna().duplicated().sum())
    if dupes > 0:
        logger.warning(f"Batch {batch_id}: dropping {dupes} duplicate SKU CODE rows (keeping first)")
        df = df.drop_duplicates(subset=["SKU CODE"], keep="first")

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
            client.table('bronze_sku_hierarchy').insert(chunk).execute()
            rows_inserted += len(chunk)
            logger.info(f"Inserted chunk {i // chunk_size + 1} for batch {batch_id}: {rows_inserted} rows total")

    except Exception as e:
        logger.error(f"Database insertion failed for batch {batch_id}: {e}. Rolling back partial inserts.")
        try:
            client.table('bronze_sku_hierarchy').delete().eq('source_batch_id', batch_id).execute()
            logger.info(f"Rollback successful for batch {batch_id}")
        except Exception as rollback_err:
            logger.error(f"Rollback failed for batch {batch_id}: {rollback_err}")

        update_batch(batch_id, None, 'ingestion_failed')
        raise RuntimeError(f"Database insertion failed: {e}")

    logger.info(f"Updating batch {batch_id} status to ingested")
    update_batch(batch_id, total_rows, 'ingested')

    return {
        "batch_id": batch_id,
        "rows_ingested": total_rows,
        "status": "ingested",
        "duplicates_dropped": dupes
    }
