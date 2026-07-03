/**
 * Pipeline worker control plane (community admin hub).
 *
 * GET  → status of every worker (definition + last run) so the Pipeline tab
 *        can show freshness. When the dispatch env isn't set (local dev)
 *        returns `mode: 'unconfigured'` with the worker defs but no last-run
 *        data.
 *
 * POST → trigger workers via workflow_dispatch. Body { worker?: string }:
 *        omit `worker` (or pass 'all') to fire every worker; pass an id to
 *        fire one. Returns per-worker outcomes so the UI can show which fired.
 *
 * Admin-gated (same allowlist as the admin pages, but 401/403 instead of a
 * redirect — this is fetched from a client component).
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import {
  PIPELINE_WORKERS,
  dispatchAllWorkers,
  dispatchWorker,
  fetchWorkerStatuses,
  findWorker,
  isWorkerDispatchConfigured,
} from "@/lib/pipeline/workers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdminResponse(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return null;
}

export async function GET() {
  const denied = await requireAdminResponse();
  if (denied) return denied;

  if (!isWorkerDispatchConfigured()) {
    return NextResponse.json({
      ok: true,
      mode: "unconfigured",
      workers: PIPELINE_WORKERS.map((w) => ({ ...w, lastRun: null })),
    });
  }

  try {
    const workers = await fetchWorkerStatuses();
    return NextResponse.json({ ok: true, mode: "configured", workers });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to load workers" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const denied = await requireAdminResponse();
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as { worker?: string };
  const target = body.worker?.trim();

  if (target && target !== "all" && !findWorker(target)) {
    return NextResponse.json({ error: `unknown worker '${target}'` }, { status: 400 });
  }

  if (!isWorkerDispatchConfigured()) {
    return NextResponse.json({ ok: true, mode: "unconfigured" });
  }

  try {
    if (!target || target === "all") {
      const results = await dispatchAllWorkers();
      return NextResponse.json({ ok: true, mode: "dispatched", results });
    }
    const worker = findWorker(target)!;
    await dispatchWorker(worker);
    return NextResponse.json({ ok: true, mode: "dispatched", results: [{ id: worker.id, ok: true }] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "dispatch failed" },
      { status: 500 }
    );
  }
}
