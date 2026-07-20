from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
import logging

from app.services.sku.silver_service import (
    create_silver_batch,
    get_silver_batch,
    list_silver_batches,
    count_bronze_rows,
)
from app.services.sku.silver_pipeline import run_silver_pipeline

router = APIRouter(prefix="/sku/silver", tags=["sku-silver"])
logger = logging.getLogger(__name__)


class ProcessRequest(BaseModel):
    started_by: str | None = None


@router.post("/process/{bronze_batch_id}")
def start_processing(bronze_batch_id: str, background_tasks: BackgroundTasks, body: ProcessRequest | None = None):
    # Guard: bronze batch must have ingested rows
    if count_bronze_rows(bronze_batch_id) == 0:
        raise HTTPException(status_code=400, detail="Bronze batch has no ingested rows. Ingest it first.")

    # Guard: refuse a second concurrent run
    for b in list_silver_batches():
        if b.get('status') == 'processing':
            raise HTTPException(status_code=409, detail="A silver pipeline run is already in progress.")

    started_by = body.started_by if body else None
    batch = create_silver_batch(bronze_batch_id, started_by)
    background_tasks.add_task(run_silver_pipeline, batch['id'], bronze_batch_id)
    logger.info(f"Silver pipeline scheduled: silver_batch={batch['id']} bronze_batch={bronze_batch_id}")
    return {"silver_batch_id": batch['id'], "status": "processing"}


@router.get("/batches")
def get_batches():
    return {"batches": list_silver_batches()}


@router.get("/status/{silver_batch_id}")
def get_status(silver_batch_id: str):
    batch = get_silver_batch(silver_batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail=f"Silver batch {silver_batch_id} not found")
    return batch
