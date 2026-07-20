import logging
from app.services.sku.supabase_service import get_client

logger = logging.getLogger(__name__)

REFERENCE_BUCKET = 'bronze-raw'
REFERENCE_PREFIX = 'sku-hierarchy/silver-reference'

REFERENCE_FILES = [
    'Brand Directory.xlsx',
    'promo_directory.csv',
    'uom_directory.csv',
    'pack_size_directory.csv',
    'SMR_CATEGORY.xlsx',
    'Grocery Nonfood Misclassified SKUs.xlsx',
]


def create_silver_batch(bronze_batch_id: str, started_by: str | None) -> dict:
    client = get_client()
    result = client.table('silver_sku_batches').insert({
        'source_bronze_batch_id': bronze_batch_id,
        'status': 'processing',
        'step': 'Queued',
        'started_by': started_by,
    }).execute()
    return result.data[0]


def update_silver_batch(silver_batch_id: str, **fields):
    client = get_client()
    client.table('silver_sku_batches').update(fields).eq('id', silver_batch_id).execute()


def set_step(silver_batch_id: str, step: str):
    logger.info(f"[silver {silver_batch_id}] {step}")
    update_silver_batch(silver_batch_id, step=step)


def get_silver_batch(silver_batch_id: str) -> dict | None:
    client = get_client()
    result = client.table('silver_sku_batches').select('*').eq('id', silver_batch_id).maybe_single().execute()
    return result.data


def list_silver_batches() -> list[dict]:
    client = get_client()
    result = client.table('silver_sku_batches').select('*').order('created_at', desc=True).execute()
    return result.data


def download_reference_file(filename: str) -> bytes:
    client = get_client()
    path = f"{REFERENCE_PREFIX}/{filename}"
    try:
        return client.storage.from_(REFERENCE_BUCKET).download(path)
    except Exception as e:
        raise RuntimeError(f"Could not download reference file '{path}': {e}") from e


def read_bronze_rows(bronze_batch_id: str, chunk_size: int = 5000):
    """Generator yielding bronze rows for the batch in chunks (list[dict])."""
    client = get_client()
    offset = 0
    while True:
        resp = client.table('bronze_sku_hierarchy').select('*') \
            .eq('source_batch_id', bronze_batch_id) \
            .order('id') \
            .range(offset, offset + chunk_size - 1).execute()
        rows = resp.data or []
        if not rows:
            break
        yield rows
        if len(rows) < chunk_size:
            break
        offset += chunk_size


def count_bronze_rows(bronze_batch_id: str) -> int:
    client = get_client()
    resp = client.table('bronze_sku_hierarchy').select('id', count='exact', head=True) \
        .eq('source_batch_id', bronze_batch_id).execute()
    return resp.count or 0


def insert_silver_rows(table: str, records: list[dict], chunk_size: int = 5000) -> int:
    client = get_client()
    inserted = 0
    for i in range(0, len(records), chunk_size):
        chunk = records[i:i + chunk_size]
        client.table(table).insert(chunk).execute()
        inserted += len(chunk)
    return inserted


def clear_silver_batch_rows(silver_batch_id: str):
    """Rollback helper: remove any rows written by a failed run."""
    client = get_client()
    client.table('silver_sku_hierarchy').delete().eq('silver_batch_id', silver_batch_id).execute()
    client.table('silver_sku_excluded').delete().eq('silver_batch_id', silver_batch_id).execute()
