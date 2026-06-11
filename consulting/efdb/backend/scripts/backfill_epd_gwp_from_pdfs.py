#!/usr/bin/env python3
"""Backfill GWP A1-A3 + declared unit for EPDs that have no structured results
on the environdec Data Hub, by extracting them from the published EPD PDFs
with Claude (structured output against the official PDF document).

Targets records in data/india_epds_enriched.json where gwp_a1a3 is null and a
document URL exists (107 of 388 at time of writing). Results are written back
into the enriched JSON with provenance ("gwp_source": "pdf_extraction_claude"),
so scripts/import_india_epds.py picks them up unchanged.

Resumable: downloaded PDFs are cached in data/epd_india_pdfs/ and extraction
results in data/epd_india_pdf_extracted/ — re-running skips completed EPDs.

Usage (from consulting/efdb/backend, needs ANTHROPIC_API_KEY in env):
    python scripts/backfill_epd_gwp_from_pdfs.py [--limit N] [--workers N] [--apply-only]
"""
import argparse
import base64
import json
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
EFDB_DIR = SCRIPT_DIR.parent.parent  # consulting/efdb
ENRICHED_JSON = EFDB_DIR / "data" / "india_epds_enriched.json"
ENRICHED_CSV = EFDB_DIR / "data" / "india_epds_enriched.csv"
PDF_DIR = EFDB_DIR / "data" / "epd_india_pdfs"
EXTRACTED_DIR = EFDB_DIR / "data" / "epd_india_pdf_extracted"

USER_AGENT = "GreenMentor-EFDB-research/1.0 (sustainability research; hello@promad.design)"
MODEL = "claude-opus-4-8"
MAX_PDF_BYTES = 30 * 1024 * 1024  # API request limit is 32MB

SCHEMA = {
    "type": "object",
    "properties": {
        "declared_unit": {
            "type": ["string", "null"],
            "description": 'Declared (or functional) unit. Simple quantities as "<amount> <unit>", e.g. "1000 kg", "1 m2", "1 t"; otherwise the full text.',
        },
        "gwp_ghg_a1a3": {"type": ["number", "null"]},
        "gwp_fossil_a1a3": {"type": ["number", "null"]},
        "gwp_biogenic_a1a3": {"type": ["number", "null"]},
        "gwp_total_a1a3": {"type": ["number", "null"]},
        "gwp_unit": {"type": ["string", "null"]},
        "modules_reported": {"type": ["string", "null"]},
        "a1a3_was_summed": {"type": "boolean"},
        "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
        "note": {"type": ["string", "null"]},
    },
    "required": [
        "declared_unit", "gwp_ghg_a1a3", "gwp_fossil_a1a3", "gwp_biogenic_a1a3",
        "gwp_total_a1a3", "gwp_unit", "modules_reported", "a1a3_was_summed",
        "confidence", "note",
    ],
    "additionalProperties": False,
}

PROMPT = """\
This is an Environmental Product Declaration (EPD) published under the \
International EPD System (EN 15804 / ISO 14025). Extract from the LCA results:

1. declared_unit — the declared unit (or functional unit) of this EPD, exactly \
as stated. If it is a simple quantity, format it as "<amount> <unit>" (e.g. \
"1000 kg", "1 m2", "1 t"); otherwise return the full declared-unit text.
2. Climate change (GWP) results for the production stage, modules A1-A3, per \
declared unit, in kg CO2 eq. (convert if published in another unit and say so \
in note):
   - gwp_ghg_a1a3: the GWP-GHG indicator (also labelled "GWP excl. biogenic \
carbon" or "climate change - GWP-GHG")
   - gwp_fossil_a1a3: GWP-fossil
   - gwp_biogenic_a1a3: GWP-biogenic
   - gwp_total_a1a3: GWP-total (or plain "Global warming potential" / \
"climate change - total")
   If the table reports A1, A2 and A3 in separate columns with no aggregated \
A1-A3 column, sum the three and set a1a3_was_summed to true. Use null for any \
indicator the EPD does not report. Do not confuse other impact indicators \
(ODP, AP, EP, ADP, POCP...) with GWP.
3. gwp_unit — the unit of the GWP values as published (normally "kg CO2 eq.").
4. modules_reported — the declared lifecycle modules (e.g. "A1-A3, A4, C1-C4, D").

Set confidence to "low" if the results tables are unclear or poorly scanned, \
or if you had to make assumptions — and explain why in note."""


def http_get(url: str, retries: int = 3) -> bytes:
    last = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=120) as resp:
                return resp.read()
        except Exception as e:  # noqa: BLE001 - retry transient failures
            last = e
            time.sleep(2 ** attempt)
    raise RuntimeError(f"GET {url} failed after {retries} retries: {last}")


def pick_document(epd: dict) -> dict | None:
    """Prefer the English EPD document; fall back to any PDF-looking doc."""
    docs = epd.get("document_urls") or []
    for pattern in (r"^EPD document.*_en\.pdf$", r"epd.*\.pdf$", r"\.pdf$"):
        for d in docs:
            if re.search(pattern, d.get("name") or "", re.I):
                return d
    return docs[0] if docs else None


def download_pdf(epd: dict) -> Path | None:
    path = PDF_DIR / f"{epd['numeric_id']}.pdf"
    if path.exists():
        return path
    doc = pick_document(epd)
    if not doc:
        return None
    data = http_get(doc["url"])
    if not data.startswith(b"%PDF"):
        raise RuntimeError(f"{doc['name']}: not a PDF (magic={data[:8]!r})")
    if len(data) > MAX_PDF_BYTES:
        raise RuntimeError(f"{doc['name']}: {len(data)} bytes exceeds API limit")
    path.write_bytes(data)
    return path


def extract_one(client, epd: dict) -> dict:
    """Download + Claude-extract one EPD. Returns the extraction dict."""
    cache = EXTRACTED_DIR / f"{epd['numeric_id']}.json"
    if cache.exists():
        cached = json.loads(cache.read_text())
        if not cached.get("error"):  # errored EPDs (e.g. credit exhaustion) retry
            return cached

    pdf_path = download_pdf(epd)
    if pdf_path is None:
        result = {"error": "no document available"}
        cache.write_text(json.dumps(result))
        return result

    pdf_b64 = base64.standard_b64encode(pdf_path.read_bytes()).decode()
    response = client.messages.create(
        model=MODEL,
        max_tokens=16000,
        thinking={"type": "adaptive"},
        messages=[{
            "role": "user",
            "content": [
                {"type": "document",
                 "source": {"type": "base64", "media_type": "application/pdf",
                            "data": pdf_b64}},
                {"type": "text", "text": PROMPT},
            ],
        }],
        output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
    )
    if response.stop_reason != "end_turn":
        result = {"error": f"stop_reason={response.stop_reason}"}
        cache.write_text(json.dumps(result))
        return result

    result = json.loads(next(b.text for b in response.content if b.type == "text"))
    result["_usage"] = {"input": response.usage.input_tokens,
                        "output": response.usage.output_tokens}
    cache.write_text(json.dumps(result, ensure_ascii=False, indent=1))
    return result


def apply_extractions(payload: dict) -> int:
    """Merge cached extractions into the enriched JSON records. Returns count."""
    applied = 0
    for epd in payload["epds"]:
        if epd.get("gwp_a1a3") is not None:
            continue
        cache = EXTRACTED_DIR / f"{epd['numeric_id']}.json"
        if not cache.exists():
            continue
        x = json.loads(cache.read_text())
        if x.get("error"):
            continue
        # Same indicator preference as scrape_environdec.pick_gwp
        for value, indicator in ((x["gwp_ghg_a1a3"], "GWP-GHG"),
                                 (x["gwp_fossil_a1a3"], "GWP-fossil"),
                                 (x["gwp_total_a1a3"], "GWP-total")):
            if value is not None:
                break
        else:
            continue  # PDF reported no usable GWP A1-A3
        epd["gwp_a1a3"] = value
        epd["gwp_a1a3_indicator"] = indicator
        epd["gwp_unit"] = x["gwp_unit"] or "kg CO2 eq."
        epd["gwp_fossil_a1a3"] = x["gwp_fossil_a1a3"]
        epd["gwp_biogenic_a1a3"] = x["gwp_biogenic_a1a3"]
        epd["gwp_total_a1a3"] = x["gwp_total_a1a3"]
        if not (epd.get("declared_unit") or "").strip():
            epd["declared_unit"] = x["declared_unit"]
        if x.get("modules_reported") and not epd.get("life_cycle_stages"):
            epd["life_cycle_stages"] = x["modules_reported"]
        epd["gwp_source"] = "pdf_extraction_claude"
        epd["gwp_extraction_confidence"] = x["confidence"]
        if x.get("note"):
            epd["gwp_extraction_note"] = x["note"]
        applied += 1
    return applied


def rewrite_csv(payload: dict) -> None:
    import csv
    try:
        from scripts.scrape_environdec import CSV_COLUMNS
    except ImportError:
        from scrape_environdec import CSV_COLUMNS

    with open(ENRICHED_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        w.writeheader()
        for r in payload["epds"]:
            flat = dict(r)
            flat["document_count"] = len(r.get("document_urls") or [])
            w.writerow(flat)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--apply-only", action="store_true",
                    help="skip extraction; just merge cached results into the JSON")
    args = ap.parse_args()

    PDF_DIR.mkdir(parents=True, exist_ok=True)
    EXTRACTED_DIR.mkdir(parents=True, exist_ok=True)
    payload = json.loads(ENRICHED_JSON.read_text())

    if not args.apply_only:
        import anthropic
        client = anthropic.Anthropic()
        targets = [e for e in payload["epds"]
                   if e.get("gwp_a1a3") is None and e.get("document_urls")]
        def needs_extraction(e):
            cache = EXTRACTED_DIR / f"{e['numeric_id']}.json"
            return not cache.exists() or bool(
                json.loads(cache.read_text()).get("error"))

        pending = [e for e in targets if needs_extraction(e)]
        if args.limit:
            pending = pending[: args.limit]
        print(f"targets without gwp: {len(targets)} | to extract now: {len(pending)}")

        done = failed = 0
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = {pool.submit(extract_one, client, e): e for e in pending}
            for fut in as_completed(futures):
                e = futures[fut]
                try:
                    x = fut.result()
                except Exception as err:  # noqa: BLE001 - record and continue
                    (EXTRACTED_DIR / f"{e['numeric_id']}.json").write_text(
                        json.dumps({"error": str(err)[:500]}))
                    failed += 1
                    print(f"  ! {e['registration_number']}: {str(err)[:120]}", flush=True)
                    continue
                done += 1
                gwp = x.get("gwp_ghg_a1a3") or x.get("gwp_fossil_a1a3") or x.get("gwp_total_a1a3")
                print(f"  [{done + failed}/{len(pending)}] {e['registration_number']}: "
                      f"gwp={gwp} per {x.get('declared_unit')} ({x.get('confidence')})",
                      flush=True)
        print(f"extracted ok: {done} | errors: {failed}")

    applied = apply_extractions(payload)
    ENRICHED_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=1))
    try:
        rewrite_csv(payload)
    except ImportError:
        print("warning: could not import scrape_environdec — CSV not regenerated")
    have = sum(1 for e in payload["epds"] if e.get("gwp_a1a3") is not None)
    print(f"applied to JSON: {applied} | records with gwp_a1a3 now: "
          f"{have}/{len(payload['epds'])}")


if __name__ == "__main__":
    main()
