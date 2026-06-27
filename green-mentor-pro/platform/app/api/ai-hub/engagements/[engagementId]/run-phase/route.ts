import { NextResponse } from "next/server";
import { runPhase, type PhaseKey } from "@gm/orchestrator";
import { getEngagementContext } from "@/lib/engagement-session";
import { ensureOrchestratorInit } from "@/lib/orchestrator-server";

export const runtime = "nodejs";
export const maxDuration = 120;

// POST /api/ai-hub/engagements/[id]/run-phase — run the next/given phase's agent.
export async function POST(req: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  const ctx = await getEngagementContext();
  if (!ctx) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const { engagementId } = await params;
  const { phaseKey } = (await req.json()) as { phaseKey?: PhaseKey };
  if (!phaseKey) return NextResponse.json({ error: "phaseKey is required" }, { status: 400 });

  ensureOrchestratorInit(); // point the engine at @gm/orchestrator's agents/
  try {
    const result = await runPhase(ctx.orgId, engagementId, phaseKey, ctx.userId);
    return NextResponse.json({ result });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
