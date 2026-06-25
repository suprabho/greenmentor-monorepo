"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { PHASES, type PhaseKey } from "@/lib/orchestrator/pipeline";
import { transitionPhase, listPhases, cascadeStaleDownstream } from "@/lib/db/phases";
import { failRun } from "@/lib/db/runs";
import { finalizePhaseArtifacts } from "@/lib/db/artifacts";
import { updateEngagement } from "@/lib/db/engagements";
import { runPhase } from "@/lib/orchestrator/runPhase";
import type { Json } from "@/lib/db/types";
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

/**
 * Stop a phase whose agent is mid-run (or stuck). Flips `agent_running` → `failed`
 * so the row becomes runnable again (the board shows a ↻ Retry), clears the phase's
 * current_run_id, and marks the in-flight run as a user cancellation. The transition
 * is guarded: if the run already landed (→ awaiting_human_review) it's a no-op and we
 * ask the user to refresh, so we never clobber a result that just finished.
 */
export async function cancelRunAction(engagementId: string, phaseKey: PhaseKey): Promise<ActionResult> {
  const { orgId } = await authed(engagementId);

  // Capture the in-flight run id before we flip the phase off `agent_running`.
  const phase = (await listPhases(orgId, engagementId)).find((p) => p.phase_key === phaseKey);
  const runId = phase?.current_run_id ?? null;

  const moved = await transitionPhase(orgId, engagementId, phaseKey, ["agent_running"], "failed", { currentRunId: null });
  if (!moved) return { ok: false, error: "This phase isn't running anymore — refresh to see its latest state." };

  if (runId) {
    await failRun(orgId, runId, { message: "Run stopped by user", cancelled: true } as Json).catch(() => {});
  }
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

  // Send the phase back to a runnable state (rejecting any open gate), then re-run it.
  // `complete` / `approved` are allowed so the charter can be regenerated even after the
  // kickoff gate was signed off — editing a past answer and re-running is the whole point.
  const moved = await transitionPhase(
    orgId, engagementId, "kickoff",
    ["awaiting_human_review", "changes_requested", "complete", "approved"], "changes_requested",
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
 * Re-open an already-signed-off phase so it can be re-run. Sends it from a terminal
 * state (`complete`/`approved`) back to `changes_requested` (a runnable, idle state) and
 * cascades every strictly-downstream phase to `not_started` — re-running an upstream phase
 * invalidates the work that depended on it. The caller then triggers the actual run via the
 * normal run endpoint. Kickoff has its own answer-aware path (applyAnswersAndRerunKickoff).
 */
export async function reopenPhaseAction(engagementId: string, phaseKey: PhaseKey): Promise<ActionResult> {
  const { orgId } = await authed(engagementId);
  if (!PHASES[phaseKey]) return { ok: false, error: "Unknown phase." };

  const moved = await transitionPhase(
    orgId, engagementId, phaseKey,
    ["complete", "approved"], "changes_requested",
  );
  if (!moved) return { ok: false, error: "Only an approved phase can be re-opened — refresh." };

  // Later phases now rest on stale upstream output; reset them so they re-run in order.
  await cascadeStaleDownstream(orgId, engagementId, phaseKey).catch(() => {});
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
