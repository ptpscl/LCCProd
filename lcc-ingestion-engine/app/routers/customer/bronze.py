import csv
import io
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.services.customer.supabase_service import get_client

router = APIRouter(prefix="/customer/bronze", tags=["customer-bronze"])
logger = logging.getLogger(__name__)

TABLE = "bronze_customer_database"
EXPORT_LIMIT = 50_000


def _apply_filters(
    query,
    customer_number: Optional[str],
    city: Optional[str],
    province: Optional[str],
    member_location: Optional[str],
    last_visited_store: Optional[str],
):
    if customer_number:
        query = query.eq("CUSTOMER NUMBER", customer_number)
    if city:
        query = query.ilike("CITY", f"%{city}%")
    if province:
        query = query.ilike("PROVINCE", f"%{province}%")
    if member_location:
        query = query.eq("MEMBER LOCATION", member_location)
    if last_visited_store:
        query = query.eq("LAST VISITED STORE", last_visited_store)
    return query


@router.get("/stats")
def get_bronze_stats():
    client = get_client()
    try:
        count_response = client.table(TABLE).select("id", count="exact", head=True).execute()
        latest_response = (
            client.table(TABLE)
            .select("loaded_at")
            .order("loaded_at", desc=True)
            .limit(1)
            .execute()
        )
        latest = latest_response.data or []
        return {
            "total_rows": count_response.count or 0,
            "last_updated": latest[0].get("loaded_at") if latest else None,
        }
    except Exception as exc:
        logger.exception("Could not fetch Customer Bronze stats")
        raise HTTPException(status_code=500, detail=f"Database query failed: {exc}") from exc


@router.get("/rows")
def get_bronze_rows(
    customer_number: Optional[str] = None,
    city: Optional[str] = None,
    province: Optional[str] = None,
    member_location: Optional[str] = None,
    last_visited_store: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    client = get_client()
    filters = (
        customer_number, city, province, member_location, last_visited_store,
    )
    try:
        count_query = _apply_filters(
            client.table(TABLE).select("id", count="exact", head=True), *filters
        )
        total = count_query.execute().count or 0
        start = (page - 1) * page_size
        data_query = _apply_filters(client.table(TABLE).select("*"), *filters)
        response = (
            data_query.order("CUSTOMER NUMBER")
            .range(start, start + page_size - 1)
            .execute()
        )
        return {
            "rows": response.data or [],
            "page": page,
            "page_size": page_size,
            "total_matching_rows": total,
        }
    except Exception as exc:
        logger.exception("Could not fetch Customer Bronze rows")
        raise HTTPException(status_code=500, detail=f"Database query failed: {exc}") from exc


@router.get("/export")
def export_bronze_rows(
    customer_number: Optional[str] = None,
    city: Optional[str] = None,
    province: Optional[str] = None,
    member_location: Optional[str] = None,
    last_visited_store: Optional[str] = None,
):
    client = get_client()
    filters = (
        customer_number, city, province, member_location, last_visited_store,
    )
    try:
        count_query = _apply_filters(
            client.table(TABLE).select("id", count="exact", head=True), *filters
        )
        total = count_query.execute().count or 0
        if total > EXPORT_LIMIT:
            raise HTTPException(
                status_code=400,
                detail=f"Too many rows to export ({total}). Narrow filters to {EXPORT_LIMIT:,} rows or fewer.",
            )

        rows: list[dict] = []
        for offset in range(0, total, 1000):
            data_query = _apply_filters(client.table(TABLE).select("*"), *filters)
            response = (
                data_query.order("CUSTOMER NUMBER")
                .range(offset, min(offset + 999, total - 1))
                .execute()
            )
            rows.extend(response.data or [])

        def generate_csv():
            if not rows:
                return
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)
            for row in rows:
                writer.writerow(row)
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)

        return StreamingResponse(
            generate_csv(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=customer_bronze_export.csv"},
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not export Customer Bronze rows")
        raise HTTPException(status_code=500, detail=f"Database query failed: {exc}") from exc
