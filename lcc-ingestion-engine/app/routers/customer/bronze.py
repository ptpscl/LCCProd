import csv
import io
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.services.customer.supabase_service import get_client

router = APIRouter(prefix="/customer/bronze", tags=["customer"])


def _filtered(query, customer_number: Optional[str], city: Optional[str], province: Optional[str]):
    if customer_number:
        query = query.eq("CUSTOMER_NUMBER", customer_number)
    if city:
        query = query.ilike("CITY", f"%{city}%")
    if province:
        query = query.ilike("PROVINCE", f"%{province}%")
    return query


@router.get("/stats")
def stats():
    client = get_client()
    count = client.table("bronze_customer_database").select("*", count="exact", head=True).execute().count or 0
    latest = client.table("bronze_customer_database").select("loaded_at").order("loaded_at", desc=True).limit(1).execute().data
    return {"total_rows": count, "last_updated": latest[0]["loaded_at"] if latest else None}


@router.get("/rows")
def rows(customer_number: Optional[str] = None, city: Optional[str] = None, province: Optional[str] = None, page: int = 1, page_size: int = 20):
    if page < 1 or page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="Invalid pagination")
    client = get_client()
    count_query = _filtered(client.table("bronze_customer_database").select("*", count="exact", head=True), customer_number, city, province)
    total = count_query.execute().count or 0
    start = (page - 1) * page_size
    data_query = _filtered(client.table("bronze_customer_database").select("*"), customer_number, city, province)
    data = data_query.order("CUSTOMER_NUMBER").range(start, start + page_size - 1).execute().data
    return {"rows": data, "page": page, "page_size": page_size, "total_matching_rows": total}


@router.get("/export")
def export(customer_number: Optional[str] = None, city: Optional[str] = None, province: Optional[str] = None):
    client = get_client()
    count_query = _filtered(client.table("bronze_customer_database").select("*", count="exact", head=True), customer_number, city, province)
    total = count_query.execute().count or 0
    if total > 50000:
        raise HTTPException(status_code=400, detail="Narrow filters to 50,000 rows or fewer")
    all_rows = []
    for offset in range(0, total, 1000):
        query = _filtered(client.table("bronze_customer_database").select("*"), customer_number, city, province)
        all_rows.extend(query.order("CUSTOMER_NUMBER").range(offset, offset + 999).execute().data or [])

    def generate():
        if not all_rows:
            return
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=list(all_rows[0].keys()))
        writer.writeheader()
        writer.writerows(all_rows)
        yield output.getvalue()

    return StreamingResponse(generate(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=customer_export.csv"})
