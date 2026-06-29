import { NextResponse } from "next/server";
import {
  type PhaseKey,
  transitionPhase,
  finalizePhaseArtifacts,
  decidePhaseGate,
  countOpenFieldReviews,
  countOpenQuestions,
} from "@gm/orchestrator";
import { getEngagementContext } from "@/lib/engagement-session";

export const runtime = "nodejs";

// POST /api/ai-hub/engagements/[id]/gate — approve or send back a phase's HITL gate.
// Mirrors esg-agents approvePhaseAction / requestChangesAction.
export async function POST(req: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  const ctx = await getEngagementContext();
  if (!ctx) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const { engagementId } = await params;
  const { phaseKey, decision, feedback } = (await req.json()) as {
    phaseKey?: PhaseKey;
    decision?: "approve" | "request-changes";
    feedback?: string;
  };
  if (!phaseKey || !decision) {
    return NextResponse.json({ error: "phaseKey and decision are required" }, { status: 400 });
  }

  try {
    if (decision === "approve") {
      // Gate guards: open field reviews (data_collection) / open questions (kickoff) block approval.
      if (phaseKey === "data_collection") {
        const open = await countOpenFieldReviews(ctx.orgId, engagementId);
        if (open > 0) return NextResponse.json({ error: `${open} data row(s) still need review.` }, { status: 409 });
      }
      if (phaseKey === "kickoff") {
        const open = await countOpenQuestions(ctx.orgId, engagementId);
        if (open > 0) return NextResponse.json({ error: `${open} open question(s) still need an answer or waiver.` }, { status: 409 });
      }
      const moved = await transitionPhase(ctx.orgId, engagementId, phaseKey, ["awaiting_human_review", "changes_requested"], "complete");
      if (!moved) return NextResponse.json({ error: "Phase was already actioned — refresh." }, { status: 409 });
      await finalizePhaseArtifacts(ctx.orgId, engagementId, phaseKey);
      await decidePhaseGate(ctx.orgId, engagementId, phaseKey, "approved", { reviewedBy: ctx.userId });
      return NextResponse.json({ ok: true });
    }

    // request-changes
    const moved = await transitionPhase(ctx.orgId, engagementId, phaseKey, ["awaiting_human_review"], "changes_requested");
    if (!moved) return NextResponse.json({ error: "Phase was already actioned — refresh." }, { status: 409 });
    await decidePhaseGate(ctx.orgId, engagementId, phaseKey, "rejected", { reviewedBy: ctx.userId, feedback: feedback ?? null });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
