import io
import logging
import pandas as pd
import numpy as np
from app.services.loyalty.supabase_service import (
    get_batch, download_file, update_batch, get_client,
    update_batch_meta, check_existing_ingested_batch
)

logger = logging.getLogger(__name__)

class BatchNotFoundError(Exception):
    pass

class SchemaMismatchError(Exception):
    pass

EXPECTED_COLUMNS = [
    "DATE", "TRANSACTION NUMBER", "REGISTER NUMBER", "STORE CODE",
    "STORE CATEGORIZATION", "CUSTOMER NUMBER", "SKU CODE",
    "TRANSACTION TYPE", "LOYALTY SALES", "QTY SOLD"
]

def ingest_batch(batch_id: str) -> dict:
    logger.info(f"Starting ingestion for batch {batch_id}")
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
        logger.info(f"Parsing CSV/TSV for batch {batch_id}")
        df = pd.read_csv(io.BytesIO(csv_bytes), dtype=str)
    except Exception as e:
        update_batch(batch_id, None, 'ingestion_failed')
        raise SchemaMismatchError(f"Failed to parse CSV/TSV: {e}")

    df.columns = [str(c).strip().upper() for c in df.columns]
    
    missing_cols = [col for col in EXPECTED_COLUMNS if col not in df.columns]
    if missing_cols:
        update_batch(batch_id, None, 'ingestion_failed')
        raise SchemaMismatchError(f"Schema mismatch. Missing columns: {missing_cols}")

    # SINGLE STORE VALIDATION
    distinct_stores = df["STORE CODE"].dropna().unique()
    if len(distinct_stores) != 1:
        update_batch(batch_id, None, 'invalid_multi_store')
        raise SchemaMismatchError(f"File contains multiple stores or no stores ({list(distinct_stores)}). Each file must be exactly one store and one month.")
    store_code = str(distinct_stores[0])

    # SINGLE MONTH VALIDATION
    # DATE is 'YYMMDD'. e.g., '240102'. We want '20YY-MM'
    # pandas str slicing to extract YY and MM
    def extract_year_month(d_str):
        if pd.isna(d_str) or len(str(d_str)) < 6:
            return None
        s = str(d_str)
        # assuming 2000s for YY
        return f"20{s[:2]}-{s[2:4]}"
        
    year_months = df["DATE"].apply(extract_year_month).dropna().unique()
    if len(year_months) != 1:
        update_batch(batch_id, None, 'invalid_multi_month')
        raise SchemaMismatchError(f"File contains multiple months or invalid dates ({list(year_months)}). Each file must be exactly one store and one month.")
    year_month = str(year_months[0])

    logger.info(f"Validated single store ({store_code}) and single month ({year_month}) for batch {batch_id}")

    # PERSIST store_code + year_month on the batch
    update_batch_meta(batch_id, store_code, year_month)

    # DUPLICATE STORE-MONTH GUARD
    existing_batch_id = check_existing_ingested_batch(batch_id, store_code, year_month)
    if existing_batch_id:
        logger.info(f"Duplicate suspected for batch {batch_id}: existing batch {existing_batch_id} for store {store_code} and month {year_month}")
        update_batch(batch_id, None, 'duplicate_suspected')
        return {
            "batch_id": batch_id, 
            "status": "duplicate_suspected", 
            "existing_batch_id": existing_batch_id, 
            "store_code": store_code, 
            "year_month": year_month, 
            "rows_ingested": 0
        }
    else:
        logger.info(f"Duplicate guard passed for batch {batch_id}")

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
        existing_rows_response = client.table('bronze_loyalty_sales').select('id', count='exact').eq('source_batch_id', batch_id).limit(1).execute()
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
            client.table('bronze_loyalty_sales').insert(chunk).execute()
            rows_inserted += len(chunk)
            logger.info(f"Inserted chunk {i // chunk_size + 1} for batch {batch_id}: {rows_inserted} rows total")
            
    except Exception as e:
        logger.error(f"Database insertion failed for batch {batch_id}: {e}. Rolling back partial inserts.")
        try:
            client.table('bronze_loyalty_sales').delete().eq('source_batch_id', batch_id).execute()
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
        "status": "ingested"
    }
