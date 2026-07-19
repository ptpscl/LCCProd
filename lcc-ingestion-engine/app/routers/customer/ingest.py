import logging

from fastapi import APIRouter, HTTPException

from app.services.customer.customer_schema import CustomerValidationError
from app.services.customer.ingestion_service import CustomerBatchNotFoundError, ingest_batch
from app.services.customer.supabase_service import get_batch

router = APIRouter(prefix="/customer/ingest", tags=["customer-ingest"])
logger = logging.getLogger(__name__)


@router.post("/{batch_id}")
def run_ingest(batch_id: str):
    try:
        return ingest_batch(batch_id)
    except CustomerBatchNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except CustomerValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Customer ingestion failed for batch %s", batch_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{batch_id}/status")
def get_ingest_status(batch_id: str):
    batch = get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail=f"Customer batch {batch_id} not found")
    return {
        "batch_id": batch_id,
        "status": batch.get("status"),
        "row_count": batch.get("row_count"),
    }
