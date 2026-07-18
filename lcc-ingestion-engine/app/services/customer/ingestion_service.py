import io
import logging
import re
from datetime import datetime

import numpy as np
import pandas as pd

from app.services.customer.supabase_service import (
    download_file,
    get_batch,
    get_client,
    update_batch,
)

logger = logging.getLogger(__name__)


class BatchNotFoundError(Exception):
    pass


class SchemaMismatchError(Exception):
    pass


EXPECTED_COLUMNS = [
    "CUSTOMER_NUMBER",
    "GENDER",
    "BIRTHDAY",
    "AGE",
    "CITY",
    "PROVINCE",
    "EXPIRY_DATE",
    "MEMBER_LOCATION",
    "APPLICATION_DATE",
    "MEMBER_SINCE",
    "LAST_VISIT",
    "FREQUENCY_OF_VISIT",
    "LAST_VISITED_STORE",
]

DATE_COLUMNS = ["BIRTHDAY", "EXPIRY_DATE", "APPLICATION_DATE", "MEMBER_SINCE", "LAST_VISIT"]
INTEGER_COLUMNS = ["AGE", "FREQUENCY_OF_VISIT"]


def _validate_values(df: pd.DataFrame) -> None:
    customer_numbers = df["CUSTOMER_NUMBER"].fillna("").str.strip()
    if (customer_numbers == "").any():
        raise SchemaMismatchError("CUSTOMER_NUMBER is required for every row.")
    duplicates = customer_numbers[customer_numbers.duplicated()].unique().tolist()
    if duplicates:
        raise SchemaMismatchError(f"Duplicate CUSTOMER_NUMBER values in file: {duplicates[:10]}")

    for column in DATE_COLUMNS:
        invalid = []
        for value in df[column].dropna().astype(str).str.strip():
            if not value:
                continue
            try:
                datetime.strptime(value, "%Y%m%d")
            except ValueError:
                invalid.append(value)
        if invalid:
            raise SchemaMismatchError(f"{column} must use YYYYMMDD; invalid values: {invalid[:5]}")

    for column in INTEGER_COLUMNS:
        invalid = [
            value for value in df[column].dropna().astype(str).str.strip()
            if value and not re.fullmatch(r"\d+", value)
        ]
        if invalid:
            raise SchemaMismatchError(f"{column} must contain whole numbers; invalid values: {invalid[:5]}")


def ingest_batch(batch_id: str) -> dict:
    batch = get_batch(batch_id)
    if not batch:
        raise BatchNotFoundError(f"Customer batch {batch_id} not found")

    file_path = batch.get("file_path")
    if not file_path:
        raise SchemaMismatchError("Batch has no file_path")

    update_batch(batch_id, "processing")
    try:
        df = pd.read_csv(io.BytesIO(download_file(file_path)), dtype=str)
        df.columns = [str(column).strip().upper().replace(" ", "_") for column in df.columns]
        missing = [column for column in EXPECTED_COLUMNS if column not in df.columns]
        extra = [column for column in df.columns if column not in EXPECTED_COLUMNS]
        if missing or extra:
            raise SchemaMismatchError(f"Schema mismatch. Missing: {missing}; Extra: {extra}")

        df = df[EXPECTED_COLUMNS]
        _validate_values(df)
        df["source_batch_id"] = batch_id
        df = df.replace({np.nan: None})
        records = df.to_dict(orient="records")

        client = get_client()
        existing = (
            client.table("bronze_customer_database")
            .select("id", count="exact")
            .eq("source_batch_id", batch_id)
            .limit(1)
            .execute()
        )
        if existing.count:
            update_batch(batch_id, "ingested", len(records))
            return {"batch_id": batch_id, "rows_ingested": 0, "status": "already_ingested"}

        try:
            for start in range(0, len(records), 5000):
                client.table("bronze_customer_database").insert(records[start:start + 5000]).execute()
        except Exception:
            client.table("bronze_customer_database").delete().eq("source_batch_id", batch_id).execute()
            raise

        update_batch(batch_id, "ingested", len(records))
        return {"batch_id": batch_id, "rows_ingested": len(records), "status": "ingested"}
    except SchemaMismatchError:
        update_batch(batch_id, "validation_failed")
        raise
    except Exception:
        logger.exception("Customer ingestion failed for batch %s", batch_id)
        update_batch(batch_id, "ingestion_failed")
        raise
