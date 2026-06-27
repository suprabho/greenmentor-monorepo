import { NextResponse } from "next/server";
import {
  listReviews, listOpenQuestions, countOpenQuestions,
  decideReview, resolveOpenQuestion,
  updateEngagement, transitionPhase, decidePhaseGate, runPhase,
} from "@gm/orchestrator";
import { getEngagementContext } from "@/lib/engagement-session";
import { ensureOrchestratorInit } from "@/lib/orchestrator-server";

export const runtime = "nodejs";
export const maxDuration = 120;

// GET — the HITL detail for the board: kickoff open questions + data-collection field reviews.
export async function GET(_req: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  const ctx = await getEngagementContext();
  if (!ctx) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const { engagementId } = await params;

  const [openQuestions, fieldRows] = await Promise.all([
    listOpenQuestions(ctx.orgId, engagementId),
    listReviews(ctx.orgId, engagementId, "data_collection"),
  ]);
  const fieldReviews = fieldRows.filter((r) => r.subject_type === "field");
  return NextResponse.json({ openQuestions, fieldReviews });
}

// POST — act on a review item.
//   { kind: "field", reviewId, decision: "approved"|"rejected", feedback? }
//   { kind: "question", reviewId, answer?, waived? }
//   { kind: "rerun-kickoff" }   ← feed answered questions back + re-run kickoff
export async function POST(req: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  const ctx = await getEngagementContext();
  if (!ctx) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const { engagementId } = await params;
  const body = (await req.json()) as {
    kind?: "field" | "question" | "rerun-kickoff";
    reviewId?: string;
    decision?: "approved" | "rejected";
    answer?: string;
    waived?: boolean;
    feedback?: string;
  };

  try {
    if (body.kind === "field" && body.reviewId && body.decision) {
      await decideReview(ctx.orgId, body.reviewId, body.decision, { reviewedBy: ctx.userId, feedback: body.feedback ?? null });
      return NextResponse.json({ ok: true });
    }

    if (body.kind === "question" && body.reviewId) {
      if (!body.waived && !body.answer?.trim()) {
        return NextResponse.json({ error: "Enter an answer or waive the question." }, { status: 400 });
      }
      await resolveOpenQuestion(ctx.orgId, body.reviewId, {
        answer: body.answer ?? null,
        waived: body.waived === true,
        reviewedBy: ctx.userId,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.kind === "rerun-kickoff") {
      const open = await countOpenQuestions(ctx.orgId, engagementId);
      if (open > 0) return NextResponse.json({ error: `Answer or waive all questions first (${open} remaining).` }, { status: 409 });
      const clarifications = (await listOpenQuestions(ctx.orgId, engagementId))
        .filter((q) => !q.waived && q.answer)
        .map((q) => ({ question: q.question, answer: q.answer as string }));
      await updateEngagement(ctx.orgId, engagementId, { configPatch: { kickoff_clarifications: clarifications } });
      const moved = await transitionPhase(
        ctx.orgId, engagementId, "kickoff",
        ["awaiting_human_review", "changes_requested", "complete", "approved"], "changes_requested",
      );
      if (!moved) return NextResponse.json({ error: "Phase was already actioned — refresh." }, { status: 409 });
      await decidePhaseGate(ctx.orgId, engagementId, "kickoff", "rejected", { reviewedBy: ctx.userId, feedback: "Re-run with clarifications" });
      ensureOrchestratorInit();
      await runPhase(ctx.orgId, engagementId, "kickoff", ctx.userId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "invalid review action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
