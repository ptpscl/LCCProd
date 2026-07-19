from __future__ import annotations

from datetime import datetime, timezone
import logging

from supabase import Client, create_client

from app.config import SUPABASE_SERVICE_KEY, SUPABASE_URL

logger = logging.getLogger(__name__)

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in the environment.")

_client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def get_client() -> Client:
    return _client


def get_batch(batch_id: str) -> dict | None:
    try:
        response = (
            _client.table("customer_batches")
            .select("*")
            .eq("id", batch_id)
            .maybe_single()
            .execute()
        )
        return response.data
    except Exception as exc:
        raise RuntimeError(f"Could not retrieve Customer batch {batch_id}") from exc


def update_batch(batch_id: str, status: str, row_count: int | None = None) -> None:
    values: dict[str, object] = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if row_count is not None:
        values["row_count"] = row_count
    try:
        _client.table("customer_batches").update(values).eq("id", batch_id).execute()
    except Exception as exc:
        logger.exception("Could not update Customer batch %s", batch_id)
        raise RuntimeError(f"Could not update Customer batch {batch_id}") from exc


def download_batch_file(file_path: str) -> bytes:
    try:
        return _client.storage.from_("bronze-raw").download(file_path)
    except Exception as exc:
        raise RuntimeError(f"Could not download {file_path} from bronze-raw") from exc


def count_rows_for_batch(batch_id: str) -> int:
    response = (
        _client.table("bronze_customer_database")
        .select("id", count="exact", head=True)
        .eq("source_batch_id", batch_id)
        .execute()
    )
    return response.count or 0


def insert_customer_rows(rows: list[dict], chunk_size: int = 1000) -> None:
    for start in range(0, len(rows), chunk_size):
        _client.table("bronze_customer_database").insert(rows[start:start + chunk_size]).execute()


def delete_rows_for_batch(batch_id: str) -> None:
    _client.table("bronze_customer_database").delete().eq("source_batch_id", batch_id).execute()
