import logging

from fastapi import APIRouter, HTTPException

from app.services.mms.ingestion_service import (
    BatchNotFoundError,
    SchemaMismatchError,
    ingest_batch,
)
from app.services.mms.supabase_service import get_batch

router = APIRouter(prefix="/mms/ingest", tags=["mms-ingest"])
logger = logging.getLogger(__name__)


@router.post("/{batch_id}")
def run_ingest(batch_id: str):
    try:
        return ingest_batch(batch_id)
    except HTTPException:
        raise
    except BatchNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SchemaMismatchError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("MMS ingestion failed for batch %s", batch_id)
        raise HTTPException(
            status_code=500,
            detail="MMS ingestion failed due to an internal service error",
        ) from exc


@router.get("/{batch_id}/status")
def get_ingest_status(batch_id: str):
    try:
        batch = get_batch(batch_id)
        if not batch:
            raise HTTPException(
                status_code=404, detail=f"MMS batch {batch_id} not found"
            )
        return {
            "batch_id": batch_id,
            "status": batch.get("status"),
            "row_count": batch.get("row_count"),
            "store_code": batch.get("store_code"),
            "year_month": batch.get("year_month"),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not retrieve MMS ingestion status for %s", batch_id)
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve MMS ingestion status",
        ) from exc
