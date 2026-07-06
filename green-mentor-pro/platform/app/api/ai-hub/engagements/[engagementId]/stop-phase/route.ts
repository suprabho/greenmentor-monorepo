import { NextResponse } from "next/server";
import { type PhaseKey, type Json, transitionPhase, listPhases, failRun } from "@gm/orchestrator";
import { getEngagementContext } from "@/lib/engagement-session";

export const runtime = "nodejs";

// POST /api/ai-hub/engagements/[id]/stop-phase — abort a phase that's mid-run (or
// stuck in `agent_running` after a reload) and free it to re-run. Ports esg-agents'
// cancelRunAction so the Cowork board can recover without a manual DB reset.
export async function POST(req: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  const ctx = await getEngagementContext();
  if (!ctx) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const { engagementId } = await params;
  const { phaseKey } = (await req.json()) as { phaseKey?: PhaseKey };
  if (!phaseKey) return NextResponse.json({ error: "phaseKey is required" }, { status: 400 });

  try {
    // Capture the in-flight run id before we flip the phase off `agent_running`.
    const phase = (await listPhases(ctx.orgId, engagementId)).find((p) => p.phase_key === phaseKey);
    const runId = phase?.current_run_id ?? null;

    // Guarded agent_running → failed: a no-op if the run already landed, so a
    // just-finished result is never clobbered. `failed` is re-runnable (→ Re-run).
    const moved = await transitionPhase(
      ctx.orgId,
      engagementId,
      phaseKey,
      ["agent_running"],
      "failed",
      { currentRunId: null },
    );
    if (!moved) {
      return NextResponse.json(
        { error: "This phase isn't running anymore — refresh to see its latest state." },
        { status: 409 },
      );
    }

    if (runId) {
      await failRun(ctx.orgId, runId, { message: "Run stopped by user", cancelled: true } as Json).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
