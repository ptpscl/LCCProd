from datetime import date
import csv
import io
import logging
import re
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.services.mms.supabase_service import (
    count_bronze_rows,
    fetch_bronze_rows,
    get_bronze_stats as fetch_bronze_stats,
)

router = APIRouter(prefix="/mms/bronze", tags=["mms-bronze"])
logger = logging.getLogger(__name__)

EXPORT_LIMIT = 50_000
EXPORT_PAGE_SIZE = 1_000


def _validate_date_filter(value: Optional[str], parameter: str) -> Optional[str]:
    if value is None:
        return None
    if not re.fullmatch(r"\d{6}", value):
        raise HTTPException(
            status_code=400,
            detail=f"{parameter} must be a valid YYMMDD calendar date",
        )
    try:
        date(2000 + int(value[:2]), int(value[2:4]), int(value[4:6]))
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"{parameter} must be a valid YYMMDD calendar date",
        ) from exc
    return value


def _validated_filters(
    store_code: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    sku_code: Optional[str],
) -> dict[str, Optional[str]]:
    validated_from = _validate_date_filter(date_from, "date_from")
    validated_to = _validate_date_filter(date_to, "date_to")
    if validated_from and validated_to and validated_from > validated_to:
        raise HTTPException(
            status_code=400,
            detail="date_from cannot be later than date_to",
        )
    return {
        "store_code": store_code,
        "date_from": validated_from,
        "date_to": validated_to,
        "sku_code": sku_code,
    }


@router.get("/stats")
def get_bronze_stats():
    try:
        return fetch_bronze_stats()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not fetch MMS Bronze stats")
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve MMS Bronze statistics",
        ) from exc


@router.get("/rows")
def get_bronze_rows(
    store_code: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sku_code: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    if page < 1:
        raise HTTPException(status_code=400, detail="page must be at least 1")
    if not 1 <= page_size <= 100:
        raise HTTPException(
            status_code=400, detail="page_size must be between 1 and 100"
        )

    filters = _validated_filters(store_code, date_from, date_to, sku_code)
    try:
        total = count_bronze_rows(**filters)
        rows = fetch_bronze_rows(
            **filters,
            offset=(page - 1) * page_size,
            limit=page_size,
        )
        return {
            "rows": rows,
            "page": page,
            "page_size": page_size,
            "total_matching_rows": total,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not fetch MMS Bronze rows")
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve MMS Bronze rows",
        ) from exc


@router.get("/export")
def export_bronze_rows(
    store_code: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sku_code: Optional[str] = None,
):
    filters = _validated_filters(store_code, date_from, date_to, sku_code)
    try:
        total = count_bronze_rows(**filters)
        if total > EXPORT_LIMIT:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Too many rows to export ({total}). Narrow your filters to "
                    f"{EXPORT_LIMIT:,} rows or fewer."
                ),
            )

        rows_to_export: list[dict] = []
        for offset in range(0, total, EXPORT_PAGE_SIZE):
            limit = min(EXPORT_PAGE_SIZE, total - offset)
            page_rows = fetch_bronze_rows(
                **filters,
                offset=offset,
                limit=limit,
            )
            if not page_rows:
                break
            rows_to_export.extend(page_rows)

        def generate_csv():
            if not rows_to_export:
                return

            output = io.StringIO()
            writer = csv.DictWriter(
                output, fieldnames=list(rows_to_export[0].keys())
            )
            writer.writeheader()
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

            for row in rows_to_export:
                writer.writerow(row)
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)

        return StreamingResponse(
            generate_csv(),
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=mms_bronze_export.csv"
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not export MMS Bronze rows")
        raise HTTPException(
            status_code=500,
            detail="Could not export MMS Bronze rows",
        ) from exc
