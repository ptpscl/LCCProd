from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import logging
import io
import csv
from typing import Optional
from app.services.sku.supabase_service import get_client

router = APIRouter(prefix="/sku/bronze", tags=["sku-bronze"])
logger = logging.getLogger(__name__)

def _build_filter_query(query, sku_code: Optional[str], division: Optional[str], department: Optional[str], brand: Optional[str]):
    if sku_code:
        query = query.eq("SKU_CODE", sku_code)
    if division:
        query = query.ilike("DIVISION", division)
    if department:
        query = query.ilike("DEPARTMENT", department)
    if brand:
        query = query.ilike("BRAND", brand)
    return query

@router.get("/stats")
def get_bronze_stats():
    client = get_client()
    try:
        # Get total rows
        count_response = client.table("bronze_sku_hierarchy").select("*", count="exact", head=True).execute()
        total_rows = count_response.count if count_response.count is not None else 0

        # Get last loaded_at
        latest_response = client.table("bronze_sku_hierarchy").select("loaded_at").order("loaded_at", desc=True).limit(1).execute()
        last_updated = None
        if latest_response.data and len(latest_response.data) > 0:
            last_updated = latest_response.data[0].get("loaded_at")

        return {
            "total_rows": total_rows,
            "last_updated": last_updated
        }
    except Exception as e:
        logger.error(f"Failed to fetch bronze stats: {e}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

@router.get("/rows")
def get_bronze_rows(
    sku_code: Optional[str] = None,
    division: Optional[str] = None,
    department: Optional[str] = None,
    brand: Optional[str] = None,
    page: int = 1,
    page_size: int = 20
):
    if page_size > 100:
        raise HTTPException(status_code=400, detail="page_size cannot exceed 100")

    client = get_client()
    try:
        # 1. Count query
        count_query = client.table("bronze_sku_hierarchy").select("*", count="exact", head=True)
        count_query = _build_filter_query(count_query, sku_code, division, department, brand)
        count_response = count_query.execute()
        total_matching_rows = count_response.count if count_response.count is not None else 0

        # 2. Data query
        start = (page - 1) * page_size
        end = start + page_size - 1

        data_query = client.table("bronze_sku_hierarchy").select("*")
        data_query = _build_filter_query(data_query, sku_code, division, department, brand)
        data_query = data_query.order("SKU_CODE", desc=False)
        data_query = data_query.range(start, end)

        data_response = data_query.execute()

        return {
            "rows": data_response.data,
            "page": page,
            "page_size": page_size,
            "total_matching_rows": total_matching_rows
        }
    except Exception as e:
        logger.error(f"Failed to fetch bronze rows: {e}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

@router.get("/export")
def export_bronze_rows(
    sku_code: Optional[str] = None,
    division: Optional[str] = None,
    department: Optional[str] = None,
    brand: Optional[str] = None
):
    client = get_client()
    try:
        # 1. Check count first
        count_query = client.table("bronze_sku_hierarchy").select("*", count="exact", head=True)
        count_query = _build_filter_query(count_query, sku_code, division, department, brand)
        count_response = count_query.execute()
        total_matching_rows = count_response.count if count_response.count is not None else 0

        if total_matching_rows > 50000:
            raise HTTPException(
                status_code=400,
                detail=f"Too many rows to export ({total_matching_rows}). Narrow your filters to under 50,000 rows."
            )

        # 2. Fetch all matching rows (with pagination loop in case of PostgREST limit)
        all_rows = []
        limit = 1000
        offset = 0

        while offset < total_matching_rows:
            data_query = client.table("bronze_sku_hierarchy").select("*")
            data_query = _build_filter_query(data_query, sku_code, division, department, brand)
            data_query = data_query.order("SKU_CODE", desc=False)
            data_query = data_query.range(offset, offset + limit - 1)

            res = data_query.execute()
            if not res.data:
                break

            all_rows.extend(res.data)
            offset += limit

        # 3. Stream CSV
        def iter_csv():
            if not all_rows:
                return

            output = io.StringIO()
            fieldnames = list(all_rows[0].keys())
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

            for row in all_rows:
                writer.writerow(row)
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)

        # Generate filename
        parts = ["sku_hierarchy_export"]
        if division: parts.append(division)
        if department: parts.append(department)
        if brand: parts.append(brand)
        if sku_code: parts.append(sku_code)
        filename = "_".join(parts) + ".csv"

        return StreamingResponse(
            iter_csv(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to export bronze rows: {e}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")
