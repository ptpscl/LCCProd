from fastapi import APIRouter, HTTPException
import logging
from app.services.supabase_service import get_client

router = APIRouter(prefix="/bronze", tags=["bronze"])
logger = logging.getLogger(__name__)

@router.get("/stats")
def get_bronze_stats():
    client = get_client()
    try:
        # Get total rows
        count_response = client.table("bronze_loyalty_sales").select("*", count="exact", head=True).execute()
        total_rows = count_response.count if count_response.count is not None else 0
        
        # Get last loaded_at
        latest_response = client.table("bronze_loyalty_sales").select("loaded_at").order("loaded_at", desc=True).limit(1).execute()
        last_loaded_at = None
        if latest_response.data and len(latest_response.data) > 0:
            last_loaded_at = latest_response.data[0].get("loaded_at")
            
        return {
            "total_rows": total_rows,
            "last_loaded_at": last_loaded_at
        }
    except Exception as e:
        logger.error(f"Failed to fetch bronze stats: {e}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")
