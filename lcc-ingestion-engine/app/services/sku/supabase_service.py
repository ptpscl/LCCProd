import logging
from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

logger = logging.getLogger(__name__)

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in the environment.")

_supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def get_client() -> Client:
    return _supabase_client

def download_file(bucket: str, path: str) -> bytes:
    try:
        return _supabase_client.storage.from_(bucket).download(path)
    except Exception as e:
        logger.error(f"Failed to download file {path} from bucket {bucket}: {e}")
        raise RuntimeError(f"Could not download file {path} from {bucket}") from e

def get_batch(batch_id: str) -> dict | None:
    try:
        result = _supabase_client.table('sku_batches').select('*').eq('id', batch_id).maybe_single().execute()
        return result.data
    except Exception as e:
        logger.error(f"Failed to get batch {batch_id}: {e}")
        raise RuntimeError(f"Could not retrieve batch {batch_id}") from e

def update_batch(batch_id: str, row_count: int | None, status: str):
    try:
        update_data = {"status": status}
        if row_count is not None:
            update_data["row_count"] = row_count

        _supabase_client.table('sku_batches').update(update_data).eq('id', batch_id).execute()
    except Exception as e:
        logger.error(f"Failed to update batch {batch_id}: {e}")
        raise RuntimeError(f"Could not update batch {batch_id}") from e
