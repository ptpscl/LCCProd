"""
Silver pipeline for SKU Hierarchy.

PHASE 1 (this file): a stub that proves the full plumbing end to end —
background execution, live step updates, reference-file access from Storage,
chunked bronze reads — without running the real NB2/NB3 logic yet.

PHASE 2 replaces run_pipeline_body() with the ported notebook logic:
    run_nb2(df, refs)  -> (clean_df, flagged_df)     [cleaning + exclusions]
    run_nb3(clean_df)  -> tagged_df                  [families + anomaly tags]
See pipeline_source/nb2_extracted.py and nb3_extracted.py in the package.
"""
import io
import logging
import traceback
from datetime import datetime, timezone

import pandas as pd

from app.services.sku.silver_service import (
    REFERENCE_FILES,
    set_step,
    update_silver_batch,
    download_reference_file,
    count_bronze_rows,
    read_bronze_rows,
    clear_silver_batch_rows,
)

logger = logging.getLogger(__name__)


def load_reference_files() -> dict[str, pd.DataFrame]:
    """Download all six reference files from Storage and parse them."""
    refs: dict[str, pd.DataFrame] = {}
    for filename in REFERENCE_FILES:
        raw = download_reference_file(filename)
        if filename.lower().endswith('.xlsx'):
            refs[filename] = pd.read_excel(io.BytesIO(raw), dtype=str, engine='openpyxl').fillna('')
        else:
            refs[filename] = pd.read_csv(io.BytesIO(raw), dtype=str).fillna('')
    return refs


def run_silver_pipeline(silver_batch_id: str, bronze_batch_id: str):
    """Entry point invoked as a FastAPI background task."""
    try:
        run_pipeline_body(silver_batch_id, bronze_batch_id)
    except Exception as e:
        logger.error(f"Silver pipeline failed for {silver_batch_id}: {e}\n{traceback.format_exc()}")
        try:
            clear_silver_batch_rows(silver_batch_id)
        except Exception as rollback_err:
            logger.error(f"Rollback failed for {silver_batch_id}: {rollback_err}")
        update_silver_batch(
            silver_batch_id,
            status='failed',
            step='Failed',
            error_message=str(e)[:1000],
            completed_at=datetime.now(timezone.utc).isoformat(),
        )


def run_pipeline_body(silver_batch_id: str, bronze_batch_id: str):
    # ── Step 1: reference files ───────────────────────────────────────────────
    set_step(silver_batch_id, 'Downloading reference files (0/6)')
    refs = {}
    for i, filename in enumerate(REFERENCE_FILES, start=1):
        raw = download_reference_file(filename)
        if filename.lower().endswith('.xlsx'):
            refs[filename] = pd.read_excel(io.BytesIO(raw), dtype=str, engine='openpyxl').fillna('')
        else:
            refs[filename] = pd.read_csv(io.BytesIO(raw), dtype=str).fillna('')
        set_step(silver_batch_id, f'Downloading reference files ({i}/6)')
    logger.info(f"Reference files loaded: " + ", ".join(f"{k}={len(v)} rows" for k, v in refs.items()))

    # ── Step 2: read bronze ───────────────────────────────────────────────────
    total = count_bronze_rows(bronze_batch_id)
    if total == 0:
        raise RuntimeError(f"Bronze batch {bronze_batch_id} has no rows — ingest it first.")

    set_step(silver_batch_id, f'Reading bronze rows (0 / {total:,})')
    frames = []
    read = 0
    for chunk in read_bronze_rows(bronze_batch_id):
        frames.append(pd.DataFrame(chunk))
        read += len(chunk)
        set_step(silver_batch_id, f'Reading bronze rows ({read:,} / {total:,})')
    df = pd.concat(frames, ignore_index=True)
    # drop bookkeeping columns so df matches the notebook input shape
    df = df.drop(columns=[c for c in ('id', 'source_batch_id', 'loaded_at', 'row_hash') if c in df.columns])
    logger.info(f"Bronze loaded: {df.shape[0]:,} rows x {df.shape[1]} cols")

    # ── Step 3: PHASE 1 STUB ──────────────────────────────────────────────────
    # Phase 2 replaces everything between these markers with:
    #   clean_df, flagged_df = run_nb2(df, refs)
    #   tagged_df = run_nb3(clean_df)
    #   ...chunked inserts into silver_sku_hierarchy / silver_sku_excluded...
    set_step(silver_batch_id, f'STUB: pipeline plumbing verified on {df.shape[0]:,} rows (NB2/NB3 arrive in Phase 2)')
    silver_count = 0
    excluded_count = 0
    # ── end stub ──────────────────────────────────────────────────────────────

    update_silver_batch(
        silver_batch_id,
        status='completed',
        step='Completed (Phase 1 stub)',
        silver_row_count=silver_count,
        excluded_row_count=excluded_count,
        completed_at=datetime.now(timezone.utc).isoformat(),
    )
