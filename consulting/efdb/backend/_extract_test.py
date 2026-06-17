"""Standalone harness to test extract_from_excel on a real .xlsx.

Loads consulting/efdb/.env, runs scan_excel -> extract_from_excel, and prints
the records plus any auto-split / truncation logs. No DB writes.

Usage:
    ./.venv/bin/python _extract_test.py /abs/path/to/file.xlsx [generic|epd]
"""
import asyncio
import os
import sys
import time
import uuid
from pathlib import Path

# 1. Load consulting/efdb/.env into os.environ BEFORE importing app.config
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
for line in ENV_PATH.read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    k, v = k.strip(), v.strip().strip('"').strip("'")
    os.environ.setdefault(k, v)

REAL_KEY = bool(os.environ.get("ANTHROPIC_API_KEY", "").strip())
if not REAL_KEY:
    # Allow import + inspection without a real key; we just won't call the model.
    os.environ["ANTHROPIC_API_KEY"] = "sk-ant-inspection-only"

# 2. Import the agent (this constructs the Anthropic client from settings)
from app.services.extraction.excel_agent import (   # noqa: E402
    scan_excel, extract_from_excel, _load_sheets_raw, _preprocess_sheet,
    _sheet_is_cover_or_notes, BATCH_SIZE,
)


def inspect(file_path: str):
    """Print rows -> batches per data sheet (no model calls)."""
    raw = _load_sheets_raw(file_path)
    print(f"\n=== WORKBOOK: {len(raw)} sheet(s), BATCH_SIZE={BATCH_SIZE} ===")
    data_indices = []
    for i, (name, df) in enumerate(raw.items()):
        if _sheet_is_cover_or_notes(df):
            print(f"  [{i}] {name!r}: cover/notes (skipped)")
            continue
        data_df, _ = _preprocess_sheet(df)
        n = len(data_df)
        n_batches = -(-n // BATCH_SIZE) if n else 0
        print(f"  [{i}] {name!r}: {n} data rows -> {n_batches} batch(es), {len(data_df.columns)} cols")
        if n:
            data_indices.append(i)
    return data_indices


async def run(file_path: str, document_type: str, section_indices, no_scan=False):
    metadata = None
    if no_scan:
        # Exercise extraction in isolation — no confirmed metadata block, just
        # the per-sheet context. Skips the (slow, billable) scan model call.
        print("\n=== SCAN SKIPPED (--no-scan): extracting with no confirmed metadata ===")
    else:
        print(f"\n=== SCAN (document_type={document_type}) ===")
        t0 = time.monotonic()
        # scan_excel feeds these into ScanResult, which validates them as UUIDs.
        doc_id, sess_id = str(uuid.uuid4()), str(uuid.uuid4())
        scan = await scan_excel(file_path, doc_id, sess_id, document_type)
        print(f"scan: {len(scan.sections_found)} section(s) in {time.monotonic()-t0:.1f}s")
        print(f"metadata: {scan.document_metadata.model_dump(exclude_none=True)}")
        metadata = scan.document_metadata

    print(f"\n=== EXTRACT sections {section_indices} ===")
    t0 = time.monotonic()
    records = await extract_from_excel(
        file_path, section_indices,
        confirmed_metadata=metadata,
        document_type=document_type,
    )
    print(f"\n=== RESULT: {len(records)} record(s) in {time.monotonic()-t0:.1f}s ===")
    for r in records[:3]:
        af = getattr(r.activity_name, "value", None) if r.activity_name else None
        ev = getattr(r.ef_value, "value", None) if r.ef_value else None
        gs = getattr(r.ghg_species, "value", None) if r.ghg_species else None
        print(f"  - {af!r}  ef_value={ev}  ghg={gs}")
    if len(records) > 3:
        print(f"  … and {len(records)-3} more")


def _enable_fast_pacing():
    """Skip the 15s inter-batch pacing sleep (rate-limit hygiene only — it does
    not affect the truncation/split logic). Keep real 429 backoff (60s+)."""
    import asyncio as _aio
    from app.services.extraction import excel_agent as _ea
    _orig = _aio.sleep

    async def _fast(seconds, *a, **k):
        await _orig(0.05 if seconds <= 15 else seconds, *a, **k)

    _ea.asyncio.sleep = _fast


def _set_token_cap(n):
    """Shrink the extraction output ceiling so ordinary batches overflow it,
    deterministically firing the stop_reason == 'max_tokens' auto-split path."""
    from app.services.extraction import excel_agent as _ea
    old = _ea.EXTRACT_MAX_TOKENS
    _ea.EXTRACT_MAX_TOKENS = n
    print(f"\n(cap override: EXTRACT_MAX_TOKENS {old} → {n}; forces truncation/split)")


def _limit_rows(n):
    """Cap each sheet to its first N data rows so a forced-split run stays a
    single batch (cheap). Harness-only: wraps _df_to_records, no agent change."""
    from app.services.extraction import excel_agent as _ea
    _orig = _ea._df_to_records

    def _capped(df, *a, **k):
        return _orig(df, *a, **k)[:n]

    _ea._df_to_records = _capped
    print(f"\n(row limit: first {n} data row(s) per sheet)")


def _set_batch_size(n):
    """Override the starting batch size so the adaptive-shrink path can be
    exercised with a small, cheap number of rows."""
    from app.services.extraction import excel_agent as _ea
    old = _ea.BATCH_SIZE
    _ea.BATCH_SIZE = n
    print(f"\n(batch size override: BATCH_SIZE {old} → {n})")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    # Flags are either bare ("--fast") or valued ("--cap=700"); collect both.
    flag_set, flag_vals = set(), {}
    for a in sys.argv[1:]:
        if not a.startswith("--"):
            continue
        if "=" in a:
            k, v = a[2:].split("=", 1)
            flag_vals[k] = v
        else:
            flag_set.add(a[2:])

    if not args:
        print("usage: _extract_test.py /abs/path/file.xlsx [generic|epd] [sheetIdx[,idx...]|all] "
              "[--fast] [--no-scan] [--cap=N] [--limit=N] [--batch=N]")
        sys.exit(1)
    file_path = args[0]
    document_type = args[1] if len(args) > 1 else "generic"
    sheets_arg = args[2] if len(args) > 2 else "all"

    data_indices = inspect(file_path)

    if not REAL_KEY:
        print("\n⚠️  ANTHROPIC_API_KEY is empty in consulting/efdb/.env — "
              "inspection only, skipping the model run.")
        print("    Add the real key and re-run to exercise scan + extract.")
        return
    if not data_indices:
        print("\nNo data sheets found to extract."); return

    if sheets_arg != "all":
        sections = [int(x) for x in sheets_arg.split(",")]
    else:
        sections = data_indices

    if "fast" in flag_set:
        _enable_fast_pacing()
        print("\n(fast mode: skipping 15s pacing sleeps; 429 backoff still real)")
    if "batch" in flag_vals:
        _set_batch_size(int(flag_vals["batch"]))
    if "cap" in flag_vals:
        _set_token_cap(int(flag_vals["cap"]))
    if "limit" in flag_vals:
        _limit_rows(int(flag_vals["limit"]))

    asyncio.run(run(file_path, document_type, sections, no_scan="no-scan" in flag_set))


if __name__ == "__main__":
    main()
