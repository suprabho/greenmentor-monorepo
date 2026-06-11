#!/usr/bin/env python3
"""Scrape public data for Indian EPDs listed on environdec.com.

Data sources (both public, no auth):
  1. EPD Library API   : https://api.environdec.com/api/v1/EPDLibrary/EPD/{friendlyUrl}
       -> registration metadata, validity dates, PCR, owner, geo scope, document file ids
  2. EPD Data Hub (ILCD/Soda4LCA) : https://data.environdec.com/resource/processes/{guid}?format=json&view=extended
       -> machine-readable LCIA results (GWP per module), declared/functional unit
       The Data Hub process UUID equals the EPD Library `id` GUID.

Usage:
  python3 scrape_environdec.py [--index CSV] [--limit N]

Outputs:
  consulting/efdb/data/epd_india_raw/{numeric_id}.json   (raw: {"library":..., "process":...})
  consulting/efdb/data/india_epds_enriched.json
  consulting/efdb/data/india_epds_enriched.csv

Polite scraping: descriptive User-Agent, ~0.7 s sleep between requests,
max 3 retries with exponential backoff on transient failures.
Resumable: EPDs whose raw JSON already exists on disk are not re-fetched.
"""

import argparse
import csv
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

USER_AGENT = "GreenMentor-EFDB-research/1.0 (sustainability research; hello@promad.design)"
LIBRARY_API = "https://api.environdec.com/api/v1/EPDLibrary/EPD/{friendly}"
DATAHUB_API = "https://data.environdec.com/resource/processes/{guid}?format=json&view=extended"
DATAHUB_SEARCH = (
    "https://data.environdec.com/resource/processes"
    "?search=true&format=json&pageSize=5&registrationNumber={regno}"
)
DOCS_URL = "https://api.environdec.com/api/v1/EPDLibrary/Files/EPDs/{guid}/Documents"
DOC_URL = "https://api.environdec.com/api/v1/EPDLibrary/Files/EPDs/{guid}/Documents?fileIds={file_id}"

SLEEP_BETWEEN_REQUESTS = 0.7
MAX_RETRIES = 3

SCRIPT_DIR = Path(__file__).resolve().parent
EFDB_DIR = SCRIPT_DIR.parent.parent  # consulting/efdb
DEFAULT_INDEX = EFDB_DIR / "data_india_epd_index.csv"
RAW_DIR = EFDB_DIR / "data" / "epd_india_raw"
ENRICHED_JSON = EFDB_DIR / "data" / "india_epds_enriched.json"
ENRICHED_CSV = EFDB_DIR / "data" / "india_epds_enriched.csv"

# Lifecycle module ordering for pretty-printing life_cycle_stages
MODULE_ORDER = ["A1", "A2", "A3", "A1-A3", "A4", "A5",
                "B1", "B2", "B3", "B4", "B5", "B6", "B7",
                "C1", "C2", "C3", "C4", "D"]


def http_get_json(url, allow_404=False):
    """GET a URL, return parsed JSON (or None on 404 when allow_404)."""
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
            })
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 404 and allow_404:
                return None
            if e.code in (429, 500, 502, 503, 504):
                last_err = e
                time.sleep(2 ** attempt)  # 2s, 4s, 8s backoff
                continue
            raise
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last_err = e
            time.sleep(2 ** attempt)
    raise RuntimeError(f"GET {url} failed after {MAX_RETRIES} retries: {last_err}")


def lang_value(items, lang="en"):
    """Pick the value from an ILCD multilang list [{'value':..,'lang':..}]."""
    if not items:
        return None
    if isinstance(items, dict):
        items = [items]
    for it in items:
        if it.get("lang") == lang and it.get("value"):
            return it["value"]
    for it in items:
        if it.get("value"):
            return it["value"]
    return None


def parse_lcia_results(process):
    """Extract {indicator_name: {module: float|None, 'unit': str}} from ILCD process JSON."""
    out = {}
    results = (process.get("LCIAResults") or {}).get("LCIAResult") or []
    for r in results:
        name = lang_value(
            (r.get("referenceToLCIAMethodDataSet") or {}).get("shortDescription"))
        if not name:
            continue
        modules, unit = {}, None
        for any_ in ((r.get("other") or {}).get("anies") or []):
            if any_.get("name") == "referenceToUnitGroupDataSet":
                unit = lang_value((any_.get("value") or {}).get("shortDescription"))
            elif "module" in any_:
                raw = any_.get("value")
                try:
                    modules[any_["module"]] = float(raw)
                except (TypeError, ValueError):
                    modules[any_["module"]] = None  # 'ND', 'INA', etc.
        out[name] = {"modules": modules, "unit": unit}
    return out


def pick_gwp(lcia, key_prefixes, module="A1-A3"):
    """Return (value, unit, indicator_name) for the first matching indicator with the module."""
    for prefix in key_prefixes:
        for name, data in lcia.items():
            if prefix.lower() in name.lower():
                val = data["modules"].get(module)
                if val is not None:
                    return val, data["unit"], name
    return None, None, None


def declared_modules(lcia):
    """Union of modules with numeric values across GWP indicators."""
    mods = set()
    for name, data in lcia.items():
        if "gwp" in name.lower() or "global warming" in name.lower():
            mods |= {m for m, v in data["modules"].items() if v is not None}
    # Collapse A1/A2/A3 vs A1-A3 duplicates is unnecessary; just sort
    return sorted(mods, key=lambda m: (MODULE_ORDER.index(m) if m in MODULE_ORDER else 99, m))


def extract_declared_unit(process):
    """Declared/functional unit text + reference flow details from ILCD process."""
    pi = process.get("processInformation") or {}
    qr = pi.get("quantitativeReference") or {}
    unit_text = lang_value(qr.get("functionalUnitOrOther"))
    ref_ids = qr.get("referenceToReferenceFlow") or []
    ref_flow = {}
    for ex in (process.get("exchanges") or {}).get("exchange") or []:
        if ex.get("dataSetInternalID") in ref_ids or ex.get("referenceFlow"):
            ref_flow = {
                "flow_name": lang_value(
                    (ex.get("referenceToFlowDataSet") or {}).get("shortDescription")),
                "mean_amount": ex.get("meanAmount"),
                "resulting_amount": ex.get("resultingflowAmount"),
            }
            for fp in ex.get("flowProperties") or []:
                if fp.get("referenceFlowProperty"):
                    ref_flow["reference_property"] = lang_value(fp.get("name"))
                    ref_flow["reference_amount"] = fp.get("meanValue")
                    ref_flow["reference_unit"] = fp.get("referenceUnit")
            break
    return unit_text, ref_flow


def fetch_epd(numeric_id, registration_number):
    """Fetch library metadata + data-hub process for one EPD. Returns raw dict."""
    raw = {"numeric_id": numeric_id, "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S")}

    lib = http_get_json(LIBRARY_API.format(friendly=f"epd{numeric_id}"), allow_404=True)
    raw["library"] = lib
    time.sleep(SLEEP_BETWEEN_REQUESTS)

    process = None
    guid = (lib or {}).get("id")
    if guid:
        process = http_get_json(DATAHUB_API.format(guid=guid), allow_404=True)
        time.sleep(SLEEP_BETWEEN_REQUESTS)
    if process is None and registration_number:
        # Fallback: search the data hub by registration number (without version suffix)
        base_reg = registration_number.split(":")[0]
        search = http_get_json(DATAHUB_SEARCH.format(regno=base_reg), allow_404=True)
        time.sleep(SLEEP_BETWEEN_REQUESTS)
        for hit in (search or {}).get("data") or []:
            if (hit.get("regNo") or "").startswith(base_reg):
                process = http_get_json(DATAHUB_API.format(guid=hit["uuid"]), allow_404=True)
                time.sleep(SLEEP_BETWEEN_REQUESTS)
                break
    raw["process"] = process
    return raw


def enrich_row(index_row, raw):
    """Build one consolidated record from index CSV row + raw API payloads."""
    lib = raw.get("library") or {}
    process = raw.get("process")
    guid = lib.get("id")

    rec = {
        "registration_number": index_row["registration_number"],
        "numeric_id": raw["numeric_id"],
        "product_name": lib.get("title") or index_row["material_name"],
        "manufacturer": (lib.get("epdOwner") or {}).get("companyName")
                        or index_row["manufacturer_name"],
        "material_category": index_row["material_category"],
        "product_category": index_row["product_category"],
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
        "status": lib.get("status"),
        "is_valid": lib.get("isValid"),
        "year_published": None,
        "publication_date": (lib.get("publicationDate") or "")[:10] or None,
        "version_date": (lib.get("versionDate") or "")[:10] or None,
        "valid_until": (lib.get("validUntil") or "")[:10] or None,
        "pcr": (lib.get("pcr") or {}).get("fullName"),
        "geographical_scope": ", ".join(
            g.get("name", "") for g in lib.get("geographicalScopes") or []) or None,
        "country_of_origin": index_row["country_of_origin"],
        "lca_practitioner": lib.get("lcaPractitioner"),
        "epd_pdf_url": None,
        "document_urls": [],
        "epd_url": index_row["epd_url"],
        "data_hub_dataset": process is not None,
    }
    if rec["version_date"]:
        rec["year_published"] = rec["version_date"][:4]
    elif rec["publication_date"]:
        rec["year_published"] = rec["publication_date"][:4]

    # Documents
    if guid:
        docs = []
        for d in (lib.get("documents") or []):
            docs.append({"name": d.get("name"),
                         "url": DOC_URL.format(guid=guid, file_id=d.get("id"))})
        for d in (lib.get("otherDocuments") or []):
            docs.append({"name": d.get("name"),
                         "url": DOC_URL.format(guid=guid, file_id=d.get("id"))})
        rec["document_urls"] = docs
        rec["epd_pdf_url"] = DOCS_URL.format(guid=guid)

    # LCIA results from the data hub process dataset
    if process:
        lcia = parse_lcia_results(process)
        rec["lcia_indicator_count"] = len(lcia)
        unit_text, ref_flow = extract_declared_unit(process)
        rec["declared_unit"] = unit_text
        rec["reference_flow"] = ref_flow or None

        # Preferred GWP for comparison: GWP-GHG, else GWP-fossil, else GWP-total
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


CSV_COLUMNS = [
    "registration_number", "numeric_id", "product_name", "manufacturer",
    "material_category", "product_category", "declared_unit",
    "gwp_a1a3", "gwp_unit", "gwp_a1a3_indicator",
    "gwp_fossil_a1a3", "gwp_biogenic_a1a3", "gwp_total_a1a3",
    "life_cycle_stages", "lcia_indicator_count",
    "status", "is_valid", "year_published", "publication_date",
    "version_date", "valid_until", "pcr", "geographical_scope",
    "country_of_origin", "lca_practitioner",
    "epd_pdf_url", "document_count", "epd_url", "data_hub_dataset",
]


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--index", default=str(DEFAULT_INDEX))
    ap.add_argument("--limit", type=int, default=None,
                    help="only process the first N rows (for testing)")
    args = ap.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    rows = list(csv.DictReader(open(args.index, newline="", encoding="utf-8")))
    if args.limit:
        rows = rows[: args.limit]

    records, failures = [], []
    for i, row in enumerate(rows, 1):
        m = re.search(r"epd(\d+)\s*$", row["epd_url"].strip())
        if not m:
            failures.append({"row": row["registration_number"],
                             "error": f"unparseable epd_url: {row['epd_url']}"})
            continue
        numeric_id = m.group(1)
        raw_path = RAW_DIR / f"{numeric_id}.json"

        if raw_path.exists():
            raw = json.loads(raw_path.read_text())
        else:
            try:
                raw = fetch_epd(numeric_id, row["registration_number"])
                raw_path.write_text(json.dumps(raw, ensure_ascii=False))
            except Exception as e:  # noqa: BLE001 - record and continue
                failures.append({"row": row["registration_number"], "error": str(e)})
                print(f"[{i}/{len(rows)}] epd{numeric_id} FAILED: {e}", flush=True)
                continue
            print(f"[{i}/{len(rows)}] epd{numeric_id} "
                  f"lib={'ok' if raw.get('library') else 'miss'} "
                  f"hub={'ok' if raw.get('process') else 'miss'}", flush=True)

        records.append(enrich_row(row, raw))

    # Consolidated JSON
    ENRICHED_JSON.write_text(json.dumps(
        {"source": "environdec.com (EPD Library API + EPD Data Hub ILCD)",
         "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
         "count": len(records), "failures": failures, "epds": records},
        ensure_ascii=False, indent=1))

    # Consolidated CSV (flat)
    with open(ENRICHED_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        w.writeheader()
        for r in records:
            flat = dict(r)
            flat["document_count"] = len(r.get("document_urls") or [])
            w.writerow(flat)

    # Coverage summary
    n = len(records)
    def cnt(pred): return sum(1 for r in records if pred(r))
    print(f"\n=== Coverage ({n} records, {len(failures)} failures) ===")
    print(f"library metadata : {cnt(lambda r: r['status'] is not None)}")
    print(f"data hub dataset : {cnt(lambda r: r['data_hub_dataset'])}")
    print(f"gwp_a1a3         : {cnt(lambda r: r['gwp_a1a3'] is not None)}")
    print(f"declared_unit    : {cnt(lambda r: bool(r['declared_unit']))}")
    print(f"valid_until      : {cnt(lambda r: bool(r['valid_until']))}")
    print(f"pdf/doc links    : {cnt(lambda r: bool(r['document_urls']))}")
    if failures:
        print("failures:", json.dumps(failures, indent=1))


if __name__ == "__main__":
    main()
