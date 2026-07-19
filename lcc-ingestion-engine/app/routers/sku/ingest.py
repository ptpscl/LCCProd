from fastapi import APIRouter, HTTPException
import logging
from app.services.sku.ingestion_service import ingest_batch, BatchNotFoundError, SchemaMismatchError
from app.services.sku.supabase_service import get_batch

router = APIRouter(prefix="/sku/ingest", tags=["sku-ingest"])
logger = logging.getLogger(__name__)

@router.post("/{batch_id}")
def run_ingest(batch_id: str):
    try:
        result = ingest_batch(batch_id)
        return result
    except BatchNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except SchemaMismatchError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Ingestion failed for {batch_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{batch_id}/status")
def get_ingest_status(batch_id: str):
    batch = get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail=f"Batch {batch_id} not found")

    return {
        "batch_id": batch_id,
        "status": batch.get("status"),
        "row_count": batch.get("row_count")
    }
