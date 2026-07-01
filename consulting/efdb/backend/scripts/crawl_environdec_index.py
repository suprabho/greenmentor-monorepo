#!/usr/bin/env python3
"""Crawl the full EnvironDec library index from the EPD Data Hub.

The environdec.com/library page is a frontend over the EPD Data Hub
(Soda4LCA / ILCD) API. Its process-list endpoint returns every dataset with
rich per-row metadata (uuid, regNo, name, geo, classification, owner, refYear,
validUntil, compliance). pageSize accepts up to 1000, so ~18 requests cover the
whole library (~17,400 datasets).

This replaces the hand-built data_india_epd_index.csv with a full index that
enrich_environdec.py then drives off (one extended-view fetch per uuid).

Usage:
    python3 scripts/crawl_environdec_index.py [--out CSV] [--page-size N]

Output:
    consulting/efdb/data/environdec_full_index.csv
"""
import argparse
import csv
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

USER_AGENT = "GreenMentor-EFDB-research/1.0 (sustainability research; hello@promad.design)"
LIST_URL = (
    "https://data.environdec.com/resource/processes"
    "?search=true&format=json&pageSize={ps}&startIndex={si}"
)
SLEEP_BETWEEN_PAGES = 0.5
MAX_RETRIES = 4

SCRIPT_DIR = Path(__file__).resolve().parent
EFDB_DIR = SCRIPT_DIR.parent.parent  # consulting/efdb
DEFAULT_OUT = EFDB_DIR / "data" / "environdec_full_index.csv"

COLUMNS = ["uuid", "regNo", "name", "geo", "classific", "classificSystem",
           "type", "subType", "refYear", "validUntil", "owner",
           "regAuthority", "compliance", "dataSources"]


def http_get_json(url):
    """GET a URL, return parsed JSON, retrying transient failures with backoff."""
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=90) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                last_err = e
                time.sleep(2 ** attempt)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last_err = e
            time.sleep(2 ** attempt)
    raise RuntimeError(f"GET {url} failed after {MAX_RETRIES} retries: {last_err}")


def flatten(row):
    """One Data Hub list row -> flat dict for the index CSV."""
    return {
        "uuid": row.get("uuid"),
        "regNo": row.get("regNo"),
        "name": (row.get("name") or "").strip(),
        "geo": row.get("geo"),
        "classific": row.get("classific"),
        "classificSystem": row.get("classificSystem"),
        "type": row.get("type"),
        "subType": row.get("subType"),
        "refYear": row.get("refYear"),
        "validUntil": row.get("validUntil"),
        "owner": row.get("owner"),
        "regAuthority": (row.get("regAuthority") or {}).get("name"),
        "compliance": " | ".join(c.get("name", "") for c in row.get("compliance") or []),
        "dataSources": " | ".join(d.get("name", "") for d in row.get("dataSources") or []),
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--page-size", type=int, default=1000)
    args = ap.parse_args()

    first = http_get_json(LIST_URL.format(ps=1, si=0))
    total = first["totalCount"]
    print(f"Data Hub reports {total} datasets; paging at {args.page_size}/request.")

    rows, seen = [], set()
    si = 0
    while si < total:
        page = http_get_json(LIST_URL.format(ps=args.page_size, si=si))
        batch = page.get("data") or []
        if not batch:
            break
        for r in batch:
            uid = r.get("uuid")
            if uid and uid not in seen:
                seen.add(uid)
                rows.append(flatten(r))
        print(f"  [{si:>6}/{total}] fetched {len(batch)} (cumulative {len(rows)})", flush=True)
        si += args.page_size
        time.sleep(SLEEP_BETWEEN_PAGES)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

    print(f"\nWrote {len(rows)} unique datasets -> {out}")
    if len(rows) < total:
        print(f"NOTE: {total - len(rows)} fewer than reported total "
              f"(duplicates de-duped by uuid, or list shrank mid-crawl).")


if __name__ == "__main__":
    main()
