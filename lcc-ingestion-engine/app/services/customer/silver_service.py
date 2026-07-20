from __future__ import annotations

from datetime import datetime, timezone
import logging

import psycopg

from app.config import DATABASE_URL
from app.services.customer.supabase_service import get_client

logger = logging.getLogger(__name__)

SILVER_TABLE = "silver_customer_database"
RUNS_TABLE = "customer_silver_runs"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_silver_run() -> dict:
    client = get_client()
    active = (
        client.table(RUNS_TABLE)
        .select("*")
        .in_("status", ["queued", "processing"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if active.data:
        return active.data[0]
    response = client.table(RUNS_TABLE).insert({"status": "queued"}).execute()
    if not response.data:
        raise RuntimeError("Could not create Customer Silver processing run")
    return response.data[0]


def get_silver_run(run_id: str) -> dict | None:
    response = (
        get_client().table(RUNS_TABLE)
        .select("*")
        .eq("id", run_id)
        .maybe_single()
        .execute()
    )
    return response.data


def process_silver_run(run_id: str) -> None:
    client = get_client()
    try:
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL is not configured for Customer Silver processing")
        source_count = (
            client.table("bronze_customer_database")
            .select("id", count="exact", head=True)
            .execute()
            .count or 0
        )
        client.table(RUNS_TABLE).update({
            "status": "processing",
            "source_row_count": source_count,
            "started_at": _now(),
            "updated_at": _now(),
            "error_message": None,
        }).eq("id", run_id).execute()

        # Run the long transformation on a direct PostgreSQL connection. The
        # Supabase REST API is intentionally kept for short metadata queries,
        # but it cannot reliably return a multi-minute RPC response.
        with psycopg.connect(DATABASE_URL, connect_timeout=15) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT * FROM public.refresh_customer_silver()")
                result_row = cursor.fetchone()
        if not result_row:
            raise RuntimeError("Customer Silver processor returned no result")
        processed_count, clean_count, flagged_count = result_row
        client.table(RUNS_TABLE).update({
            "status": "completed",
            "processed_row_count": processed_count,
            "clean_row_count": clean_count,
            "flagged_row_count": flagged_count,
            "completed_at": _now(),
            "updated_at": _now(),
        }).eq("id", run_id).execute()
    except Exception as exc:
        logger.exception("Customer Silver processing failed for run %s", run_id)
        try:
            client.table(RUNS_TABLE).update({
                "status": "failed",
                "error_message": str(exc)[:2000],
                "completed_at": _now(),
                "updated_at": _now(),
            }).eq("id", run_id).execute()
        except Exception:
            logger.exception("Could not mark Customer Silver run %s failed", run_id)


def get_silver_stats() -> dict:
    client = get_client()
    total = client.table(SILVER_TABLE).select("id", count="exact", head=True).execute().count or 0
    clean = (
        client.table(SILVER_TABLE).select("id", count="exact", head=True)
        .eq("validation_status", "clean").execute().count or 0
    )
    resolved = (
        client.table(SILVER_TABLE).select("id", count="exact", head=True)
        .eq("validation_status", "resolved").execute().count or 0
    )
    flagged = (
        client.table(SILVER_TABLE).select("id", count="exact", head=True)
        .eq("validation_status", "flagged").execute().count or 0
    )
    class_1a = (
        client.table(SILVER_TABLE).select("id", count="exact", head=True)
        .eq("anomaly_class", "1A").execute().count or 0
    )
    class_1b = (
        client.table(SILVER_TABLE).select("id", count="exact", head=True)
        .eq("anomaly_class", "1B").execute().count or 0
    )
    latest = (
        client.table(RUNS_TABLE).select("*")
        .order("created_at", desc=True).limit(1).execute().data or []
    )
    return {
        "total_rows": total,
        "clean_rows": clean,
        "flagged_rows": flagged,
        "resolved_rows": resolved,
        "class_0_rows": clean + resolved,
        "class_1a_rows": class_1a,
        "class_1b_rows": class_1b,
        "latest_run": latest[0] if latest else None,
    }


def get_silver_rows(
    page: int,
    page_size: int,
    validation_status: str | None = None,
    customer_number: str | None = None,
    quality_issue: str | None = None,
    anomaly_class: str | None = None,
) -> dict:
    client = get_client()

    def apply_filters(query):
        if validation_status:
            query = query.eq("validation_status", validation_status)
        if customer_number:
            query = query.eq("CUSTOMER NUMBER", customer_number.strip().upper())
        if quality_issue:
            query = query.contains("quality_issues", [quality_issue])
        if anomaly_class:
            query = query.eq("anomaly_class", anomaly_class)
        return query

    count_response = apply_filters(
        client.table(SILVER_TABLE).select("id", count="exact", head=True)
    ).execute()
    total = count_response.count or 0
    start = (page - 1) * page_size
    rows = (
        apply_filters(client.table(SILVER_TABLE).select("*"))
        .order("CUSTOMER NUMBER")
        .range(start, start + page_size - 1)
        .execute()
        .data or []
    )
    return {
        "rows": rows,
        "page": page,
        "page_size": page_size,
        "total_matching_rows": total,
    }
