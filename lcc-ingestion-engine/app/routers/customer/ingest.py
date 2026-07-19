import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, status

from app.services.customer.ingestion_service import ingest_batch
from app.services.customer.supabase_service import get_batch, update_batch

router = APIRouter(prefix="/customer/ingest", tags=["customer-ingest"])
logger = logging.getLogger(__name__)


def _run_ingestion_in_background(batch_id: str) -> None:
    try:
        ingest_batch(batch_id)
    except Exception:
        # ingest_batch persists the appropriate failure status before raising.
        logger.exception("Background Customer ingestion failed for batch %s", batch_id)


@router.post("/{batch_id}", status_code=status.HTTP_202_ACCEPTED)
def run_ingest(batch_id: str, background_tasks: BackgroundTasks):
    batch = get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail=f"Customer batch {batch_id} not found")

    current_status = batch.get("status")
    if current_status == "ingested":
        return {
            "batch_id": batch_id,
            "status": "already_ingested",
            "row_count": batch.get("row_count"),
        }
    if current_status == "processing":
        return {"batch_id": batch_id, "status": "processing"}

    try:
        # Persist this before scheduling so repeated clicks cannot queue duplicates.
        update_batch(batch_id, "processing")
    except Exception as exc:
        logger.exception("Could not queue Customer batch %s", batch_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    background_tasks.add_task(_run_ingestion_in_background, batch_id)
    return {"batch_id": batch_id, "status": "processing"}


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
