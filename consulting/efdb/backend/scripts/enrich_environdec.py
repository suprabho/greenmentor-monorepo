#!/usr/bin/env python3
"""Enrich the full EnvironDec index with machine-readable GWP / declared-unit data.

Driven off environdec_full_index.csv (from crawl_environdec_index.py). For each
dataset it fetches ONLY the EPD Data Hub extended view by uuid — the uuid is
already known, so the Library API (currently down) and the data-hub search
fallback used by the India scraper are unnecessary.

Reuses the ILCD parsers from scrape_environdec.py verbatim:
    parse_lcia_results, pick_gwp, declared_modules, extract_declared_unit
so GWP indicator selection and declared-unit derivation match the India set.

Output matches the shape of india_epds_enriched.json so import_environdec_epds.py
can consume it the same way.

Usage:
    python3 scripts/enrich_environdec.py [--index CSV] [--limit N] [--workers K]

Outputs:
    consulting/efdb/data/epd_environdec_raw/{uuid}.json   (raw process cache; resumable)
    consulting/efdb/data/environdec_epds_enriched.json
"""
import argparse
import csv
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# Reuse the polite HTTP client + ILCD parsing helpers from the India scraper.
from scripts.scrape_environdec import (
    http_get_json, parse_lcia_results, pick_gwp, declared_modules,
    extract_declared_unit, DATAHUB_API,
)

SCRIPT_DIR = Path(__file__).resolve().parent
EFDB_DIR = SCRIPT_DIR.parent.parent  # consulting/efdb
DEFAULT_INDEX = EFDB_DIR / "data" / "environdec_full_index.csv"
RAW_DIR = EFDB_DIR / "data" / "epd_environdec_raw"
ENRICHED_JSON = EFDB_DIR / "data" / "environdec_epds_enriched.json"

SLEEP_PER_TASK = 0.3  # polite per-worker pause
IES_RE = re.compile(r"EPD-IES-0*(\d+)", re.I)


def reg_base(reg_no: str) -> str:
    """'EPD-IES-0007415:004 (S-P-07415)' -> 'EPD-IES-0007415:004'."""
    return (reg_no or "").split(" (")[0].strip()


def library_url(reg_no: str, uuid: str) -> str:
    """Friendly environdec.com library URL (epd<IES number>), else Data Hub URL."""
    m = IES_RE.search(reg_no or "")
    if m:
        return f"https://www.environdec.com/library/epd{int(m.group(1))}"
    return f"https://data.environdec.com/resource/processes/{uuid}?view=extended"


def numeric_id(reg_no: str) -> str | None:
    m = IES_RE.search(reg_no or "")
    return str(int(m.group(1))) if m else None


def build_record(row: dict, process: dict | None) -> dict:
    """Consolidate one index row + its Data Hub process into an enriched record."""
    reg = reg_base(row.get("regNo", ""))
    uuid = row.get("uuid")
    rec = {
        "registration_number": reg,
        "uuid": uuid,
        "numeric_id": numeric_id(reg),
        "product_name": (row.get("name") or "").strip(),
        "manufacturer": row.get("owner"),
        "classification": row.get("classific"),
        "sub_type": row.get("subType"),
        "compliance": [c for c in (row.get("compliance") or "").split(" | ") if c],
        "geo": row.get("geo"),
        "ref_year": int(row["refYear"]) if (row.get("refYear") or "").strip().isdigit() else None,
        "valid_until_year": int(row["validUntil"]) if (row.get("validUntil") or "").strip().isdigit() else None,
        "declared_unit": None,
        "reference_flow": None,
        "gwp_a1a3": None,
        "gwp_a1a3_indicator": None,
        "gwp_fossil_a1a3": None,
        "gwp_biogenic_a1a3": None,
        "gwp_total_a1a3": None,
        "gwp_total_modules": None,
        "gwp_unit": None,
        "life_cycle_stages": None,
        "lcia_indicator_count": None,
        "data_hub_dataset": process is not None,
        "source_url": library_url(reg, uuid),
        "epd_url": library_url(reg, uuid),
    }
    if process:
        lcia = parse_lcia_results(process)
        rec["lcia_indicator_count"] = len(lcia)
        unit_text, ref_flow = extract_declared_unit(process)
        rec["declared_unit"] = unit_text
        rec["reference_flow"] = ref_flow or None

        val, unit, ind = pick_gwp(lcia, ["GWP-GHG", "GWP-fossil", "GWP-total"])
        rec["gwp_a1a3"], rec["gwp_unit"], rec["gwp_a1a3_indicator"] = val, unit, ind
        rec["gwp_fossil_a1a3"], _, _ = pick_gwp(lcia, ["GWP-fossil"])
        rec["gwp_biogenic_a1a3"], _, _ = pick_gwp(lcia, ["GWP-biogenic"])
        rec["gwp_total_a1a3"], _, _ = pick_gwp(lcia, ["GWP-total"])
        for name, data in lcia.items():
            if "gwp-total" in name.lower():
                rec["gwp_total_modules"] = data["modules"]
                break
        mods = declared_modules(lcia)
        rec["life_cycle_stages"] = ", ".join(mods) if mods else None
    return rec


def enrich_one(row: dict) -> dict:
    """Fetch (or load cached) the Data Hub process for one row and build its record."""
    uuid = row.get("uuid")
    raw_path = RAW_DIR / f"{uuid}.json"
    if raw_path.exists():
        process = json.loads(raw_path.read_text())
        process = process if process else None
    else:
        process = http_get_json(DATAHUB_API.format(guid=uuid), allow_404=True)
        raw_path.write_text(json.dumps(process, ensure_ascii=False) if process else "null")
        time.sleep(SLEEP_PER_TASK)
    return build_record(row, process)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--index", default=str(DEFAULT_INDEX))
    ap.add_argument("--limit", type=int, default=None, help="only the first N rows (testing)")
    ap.add_argument("--workers", type=int, default=5)
    args = ap.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    rows = list(csv.DictReader(open(args.index, newline="", encoding="utf-8")))
    if args.limit:
        rows = rows[: args.limit]
    rows = [r for r in rows if r.get("uuid")]

    records, failures = [], []
    done = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(enrich_one, r): r for r in rows}
        for fut in as_completed(futs):
            r = futs[fut]
            done += 1
            try:
                records.append(fut.result())
            except Exception as e:  # noqa: BLE001 - record and continue
                failures.append({"uuid": r.get("uuid"), "regNo": r.get("regNo"), "error": str(e)})
            if done % 250 == 0 or done == len(rows):
                gwp = sum(1 for x in records if x.get("gwp_a1a3") is not None)
                print(f"  [{done}/{len(rows)}] enriched={len(records)} "
                      f"gwp={gwp} fail={len(failures)}", flush=True)

    ENRICHED_JSON.write_text(json.dumps(
        {"source": "environdec.com EPD Data Hub (ILCD extended view)",
         "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
         "count": len(records), "failures": failures, "epds": records},
        ensure_ascii=False, indent=1))

    n = len(records)
    def cnt(p): return sum(1 for x in records if p(x))
    print(f"\n=== Coverage ({n} records, {len(failures)} failures) ===")
    print(f"data hub dataset : {cnt(lambda x: x['data_hub_dataset'])}")
    print(f"gwp_a1a3         : {cnt(lambda x: x['gwp_a1a3'] is not None)}")
    print(f"declared_unit    : {cnt(lambda x: bool(x['declared_unit']))}")
    print(f"-> {ENRICHED_JSON}")


if __name__ == "__main__":
    main()
