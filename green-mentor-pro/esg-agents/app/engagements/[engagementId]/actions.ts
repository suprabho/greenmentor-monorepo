"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import type { PhaseKey } from "@/lib/orchestrator/pipeline";
import { transitionPhase } from "@/lib/db/phases";
import { finalizePhaseArtifacts } from "@/lib/db/artifacts";
import { updateEngagement } from "@/lib/db/engagements";
import { runPhase } from "@/lib/orchestrator/runPhase";
import {
  decidePhaseGate, decideReview, countOpenFieldReviews,
  countOpenQuestions, resolveOpenQuestion, listOpenQuestions,
} from "@/lib/db/reviews";

interface ActionResult {
  ok: boolean;
  error?: string;
}

async function authed(engagementId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return { orgId: session.orgUuid, userUuid: session.userUuid, engagementId };
}

/** Approve a phase gate → finalize its artifacts and mark the phase complete. */
export async function approvePhaseAction(engagementId: string, phaseKey: PhaseKey): Promise<ActionResult> {
  const { orgId, userUuid } = await authed(engagementId);

  // Data-collection can't be approved while field rows are still open.
  if (phaseKey === "data_collection") {
    const open = await countOpenFieldReviews(orgId, engagementId);
    if (open > 0) return { ok: false, error: `${open} data row(s) still need review.` };
  }
  // Kick-off can't be approved while scoping questions are still unanswered.
  if (phaseKey === "kickoff") {
    const open = await countOpenQuestions(orgId, engagementId);
    if (open > 0) return { ok: false, error: `${open} open question(s) still need an answer or waiver.` };
  }

  const moved = await transitionPhase(orgId, engagementId, phaseKey, ["awaiting_human_review", "changes_requested"], "complete");
  if (!moved) return { ok: false, error: "Phase was already actioned — refresh." };

  await finalizePhaseArtifacts(orgId, engagementId, phaseKey);
  await decidePhaseGate(orgId, engagementId, phaseKey, "approved", { reviewedBy: userUuid });
  revalidatePath(`/engagements/${engagementId}`);
  return { ok: true };
}

/** Send a phase back for changes (re-runnable). */
export async function requestChangesAction(
  engagementId: string,
  phaseKey: PhaseKey,
  feedback?: string,
): Promise<ActionResult> {
  const { orgId, userUuid } = await authed(engagementId);
  const moved = await transitionPhase(orgId, engagementId, phaseKey, ["awaiting_human_review"], "changes_requested");
  if (!moved) return { ok: false, error: "Phase was already actioned — refresh." };
  await decidePhaseGate(orgId, engagementId, phaseKey, "rejected", { reviewedBy: userUuid, feedback: feedback ?? null });
  revalidatePath(`/engagements/${engagementId}`);
  return { ok: true };
}

/** Approve / reject a single data-collection field review row. */
export async function decideReviewAction(
  engagementId: string,
  reviewId: string,
  decision: "approved" | "rejected",
  feedback?: string,
): Promise<ActionResult> {
  const { orgId, userUuid } = await authed(engagementId);
  await decideReview(orgId, reviewId, decision, { reviewedBy: userUuid, feedback: feedback ?? null });
  revalidatePath(`/engagements/${engagementId}`);
  return { ok: true };
}

/** Answer or waive a single kickoff open question (clears it from the scope gate). */
export async function answerOpenQuestionAction(
  engagementId: string,
  reviewId: string,
  patch: { answer?: string; waived?: boolean },
): Promise<ActionResult> {
  const { orgId, userUuid } = await authed(engagementId);
  if (!patch.waived && !patch.answer?.trim()) {
    return { ok: false, error: "Enter an answer or waive the question." };
  }
  await resolveOpenQuestion(orgId, reviewId, {
    answer: patch.answer ?? null,
    waived: patch.waived === true,
    reviewedBy: userUuid,
  });
  revalidatePath(`/engagements/${engagementId}`);
  return { ok: true };
}

/**
 * Feed the answered open questions back into the kickoff agent and re-run it so the
 * scope charter is regenerated on confirmed inputs. Requires every question answered
 * or waived first. Leaves the phase awaiting_human_review with a fresh charter.
 */
export async function applyAnswersAndRerunKickoffAction(engagementId: string): Promise<ActionResult> {
  const { orgId, userUuid } = await authed(engagementId);

  const open = await countOpenQuestions(orgId, engagementId);
  if (open > 0) return { ok: false, error: `Answer or waive all questions first (${open} remaining).` };

  const clarifications = (await listOpenQuestions(orgId, engagementId))
    .filter((q) => !q.waived && q.answer)
    .map((q) => ({ question: q.question, answer: q.answer as string }));

  // Persist so assemblePhaseInput can hand them to the agent on the re-run.
  await updateEngagement(orgId, engagementId, { configPatch: { kickoff_clarifications: clarifications } });

  // Send the phase back to a runnable state (rejecting the open gate), then re-run it.
  const moved = await transitionPhase(
    orgId, engagementId, "kickoff",
    ["awaiting_human_review", "changes_requested"], "changes_requested",
  );
  if (!moved) return { ok: false, error: "Phase was already actioned — refresh." };
  await decidePhaseGate(orgId, engagementId, "kickoff", "rejected", { reviewedBy: userUuid, feedback: "Re-run with clarifications" });

  try {
    await runPhase(orgId, engagementId, "kickoff", userUuid);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Re-run failed." };
  }
  revalidatePath(`/engagements/${engagementId}`);
  return { ok: true };
}

/**
 * Set the engagement's data source: "demo" (hardcoded fixtures) or "user" (uploaded
 * documents). Persisted to engagement.config; read by assemblePhaseInput on each run.
 */
export async function setDataSourceModeAction(
  engagementId: string,
  mode: "demo" | "user",
): Promise<ActionResult> {
  const { orgId } = await authed(engagementId);
  if (mode !== "demo" && mode !== "user") return { ok: false, error: "Invalid data source mode." };
  await updateEngagement(orgId, engagementId, { configPatch: { data_source_mode: mode } });
  revalidatePath(`/engagements/${engagementId}`);
  return { ok: true };
}

/** Revalidate the engagement route (used by the chat copilot after an action). */
export async function refreshEngagementAction(engagementId: string): Promise<void> {
  await authed(engagementId);
  revalidatePath(`/engagements/${engagementId}`);
}
