import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status

from app.services.customer.silver_service import (
    create_silver_run,
    get_silver_rows,
    get_silver_run,
    get_silver_stats,
    process_silver_run,
)

router = APIRouter(prefix="/customer/silver", tags=["customer-silver"])
logger = logging.getLogger(__name__)


@router.post("/process", status_code=status.HTTP_202_ACCEPTED)
def start_silver_processing(background_tasks: BackgroundTasks):
    try:
        run = create_silver_run()
        if run.get("status") == "queued":
            background_tasks.add_task(process_silver_run, run["id"])
        return run
    except Exception as exc:
        logger.exception("Could not start Customer Silver processing")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/runs/{run_id}")
def get_processing_run(run_id: str):
    try:
        run = get_silver_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Customer Silver run not found")
        return run
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/stats")
def silver_stats():
    try:
        return get_silver_stats()
    except Exception as exc:
        logger.exception("Could not load Customer Silver statistics")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/rows")
def silver_rows(
    validation_status: str | None = Query(default=None, pattern="^(clean|flagged|resolved)$"),
    customer_number: str | None = None,
    quality_issue: str | None = None,
    anomaly_class: str | None = Query(default=None, pattern="^(0|1A|1B)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    try:
        return get_silver_rows(
            page, page_size, validation_status, customer_number, quality_issue,
            anomaly_class,
        )
    except Exception as exc:
        logger.exception("Could not load Customer Silver rows")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
