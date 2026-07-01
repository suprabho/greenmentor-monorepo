#!/usr/bin/env python3
"""Run all enabled EnvironDec watches once.

For each enabled watch this re-runs its Data Hub search, finds EPDs not seen
before (and not already in EFDB), and either queues them for review
(mode='queue') or ingests them into a review session (mode='auto'). It reuses
the exact same `_run_watch` logic as the API endpoint so behaviour is identical.

Intended to run on a schedule. NB: the EFDB backend has no CI/CD — it is
deployed manually to Fly.io — so merging this to main does NOT start running it.
Wire it up explicitly, e.g. a Fly scheduled Machine:

    fly machine run . --schedule daily \\
        --entrypoint "python -m scripts.run_environdec_watches"

or a cron inside the app VM. Runs against DATABASE_URL from consulting/efdb/.env.

Manual run (from backend/ with the venv):
    .venv/bin/python -m scripts.run_environdec_watches
"""
import asyncio
from pathlib import Path

from dotenv import load_dotenv

# Load env before importing app.* (settings read at import).
load_dotenv(Path(__file__).resolve().parents[2] / ".env")


async def main() -> None:
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.environdec_watch import EnvirondecWatch
    from app.models.user import User
    # Import lazily: pulls in the FastAPI router module, which owns _run_watch.
    from app.routers.ingestion import _run_watch

    async with AsyncSessionLocal() as db:
        # Attribute new sessions / auto-ingests to the first admin (same
        # convention as the bulk importer).
        admin = (await db.execute(
            select(User).where(User.role == "admin").order_by(User.created_at).limit(1)
        )).scalar_one_or_none()
        if not admin:
            print("No admin user found — cannot attribute watch runs. Aborting.")
            return

        watches = list((await db.execute(
            select(EnvirondecWatch).where(EnvirondecWatch.enabled == True)  # noqa: E712
        )).scalars())
        if not watches:
            print("No enabled watches.")
            return

        print(f"Running {len(watches)} watch(es) as {admin.email}…")
        totals = {"new": 0, "queued": 0, "auto": 0}
        for w in watches:
            try:
                r = await _run_watch(w, db, admin)
            except Exception as exc:  # noqa: BLE001 - report and continue
                print(f"  ! {w.name}: FAILED ({exc})")
                continue
            totals["new"] += r.new_found
            totals["queued"] += r.queued
            totals["auto"] += r.auto_ingested
            note = f"session {r.session_id}" if r.session_id else ""
            print(f"  {w.name} [{w.mode}]: {r.new_found} new "
                  f"→ queued {r.queued}, auto-ingested {r.auto_ingested} {note}".rstrip())

        print(f"\nDone. {totals['new']} new EPD(s): "
              f"{totals['queued']} queued, {totals['auto']} auto-ingested (pending review).")


if __name__ == "__main__":
    asyncio.run(main())
