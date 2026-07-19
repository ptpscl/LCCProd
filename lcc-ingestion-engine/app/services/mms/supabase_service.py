from __future__ import annotations

import logging
from typing import Any, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from supabase import Client

logger = logging.getLogger(__name__)

BATCH_TABLE = "mms_batches"
BRONZE_TABLE = "bronze_mms"
RAW_BUCKET = "bronze-raw"

_client: "Client | None" = None


def get_client() -> "Client":
    """Return the service-role client, creating it only when first needed."""
    global _client
    if _client is None:
        from app.config import SUPABASE_SERVICE_KEY, SUPABASE_URL

        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in the environment."
            )
        from supabase import create_client

        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


def get_batch(batch_id: str) -> dict | None:
    try:
        response = (
            get_client()
            .table(BATCH_TABLE)
            .select("*")
            .eq("id", batch_id)
            .maybe_single()
            .execute()
        )
        return response.data
    except Exception as exc:
        logger.exception("Could not retrieve MMS batch %s", batch_id)
        raise RuntimeError(f"Could not retrieve MMS batch {batch_id}") from exc


def download_batch_file(file_path: str) -> bytes:
    try:
        return get_client().storage.from_(RAW_BUCKET).download(file_path)
    except Exception as exc:
        logger.exception("Could not download MMS file %s", file_path)
        raise RuntimeError(
            f"Could not download {file_path} from {RAW_BUCKET}"
        ) from exc


def update_batch(batch_id: str, row_count: int | None, status: str) -> None:
    values: dict[str, Any] = {"status": status}
    if row_count is not None:
        values["row_count"] = row_count
    try:
        get_client().table(BATCH_TABLE).update(values).eq("id", batch_id).execute()
    except Exception as exc:
        logger.exception("Could not update MMS batch %s", batch_id)
        raise RuntimeError(f"Could not update MMS batch {batch_id}") from exc


def update_batch_meta(batch_id: str, store_code: str, year_month: str) -> None:
    try:
        (
            get_client()
            .table(BATCH_TABLE)
            .update({"store_code": store_code, "year_month": year_month})
            .eq("id", batch_id)
            .execute()
        )
    except Exception as exc:
        logger.exception("Could not update MMS metadata for batch %s", batch_id)
        raise RuntimeError(f"Could not update MMS metadata for batch {batch_id}") from exc


def check_existing_ingested_batch(
    batch_id: str, store_code: str, year_month: str
) -> str | None:
    try:
        response = (
            get_client()
            .table(BATCH_TABLE)
            .select("id")
            .eq("store_code", store_code)
            .eq("year_month", year_month)
            .eq("status", "ingested")
            .neq("id", batch_id)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        return rows[0]["id"] if rows else None
    except Exception as exc:
        logger.exception(
            "Could not check existing MMS batch for store %s and month %s",
            store_code,
            year_month,
        )
        raise RuntimeError("Could not check for an existing ingested MMS batch") from exc


def count_rows_for_batch(batch_id: str) -> int:
    try:
        response = (
            get_client()
            .table(BRONZE_TABLE)
            .select("id", count="exact", head=True)
            .eq("source_batch_id", batch_id)
            .execute()
        )
        return response.count or 0
    except Exception as exc:
        logger.exception("Could not count MMS rows for batch %s", batch_id)
        raise RuntimeError(f"Could not count MMS rows for batch {batch_id}") from exc


def insert_mms_rows(rows: list[dict], chunk_size: int = 5_000) -> None:
    client = get_client()
    for start in range(0, len(rows), chunk_size):
        client.table(BRONZE_TABLE).insert(rows[start:start + chunk_size]).execute()


def delete_rows_for_batch(batch_id: str) -> None:
    try:
        (
            get_client()
            .table(BRONZE_TABLE)
            .delete()
            .eq("source_batch_id", batch_id)
            .execute()
        )
    except Exception as exc:
        logger.exception("Could not delete MMS rows for batch %s", batch_id)
        raise RuntimeError(f"Could not delete MMS rows for batch {batch_id}") from exc


def _apply_bronze_filters(
    query,
    store_code: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sku_code: Optional[str] = None,
):
    if store_code:
        query = query.eq("STORE_CODE", store_code)
    if date_from:
        query = query.gte("DATE", date_from)
    if date_to:
        query = query.lte("DATE", date_to)
    if sku_code:
        query = query.eq("SKU_CODE", sku_code)
    return query


def count_bronze_rows(
    store_code: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sku_code: Optional[str] = None,
) -> int:
    try:
        query = (
            get_client()
            .table(BRONZE_TABLE)
            .select("id", count="exact", head=True)
        )
        query = _apply_bronze_filters(
            query, store_code, date_from, date_to, sku_code
        )
        response = query.execute()
        return response.count or 0
    except Exception as exc:
        logger.exception("Could not count filtered MMS Bronze rows")
        raise RuntimeError("Could not count MMS Bronze rows") from exc


def get_latest_loaded_at() -> str | None:
    try:
        response = (
            get_client()
            .table(BRONZE_TABLE)
            .select("loaded_at")
            .order("loaded_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        return rows[0].get("loaded_at") if rows else None
    except Exception as exc:
        logger.exception("Could not retrieve the latest MMS Bronze load time")
        raise RuntimeError("Could not retrieve MMS Bronze load time") from exc


def get_bronze_stats() -> dict:
    return {
        "total_rows": count_bronze_rows(),
        "last_updated": get_latest_loaded_at(),
    }


def fetch_bronze_rows(
    *,
    store_code: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sku_code: Optional[str] = None,
    offset: int,
    limit: int,
) -> list[dict]:
    if offset < 0:
        raise ValueError("offset cannot be negative")
    if not 1 <= limit <= 1_000:
        raise ValueError("limit must be between 1 and 1000")

    try:
        query = get_client().table(BRONZE_TABLE).select("*")
        query = _apply_bronze_filters(
            query, store_code, date_from, date_to, sku_code
        )
        response = (
            query.order("DATE", desc=False)
            .order("TRANSACTION_NUMBER", desc=False)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return response.data or []
    except Exception as exc:
        logger.exception("Could not retrieve paginated MMS Bronze rows")
        raise RuntimeError("Could not retrieve MMS Bronze rows") from exc
