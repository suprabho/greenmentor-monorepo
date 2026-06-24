"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import type { PhaseKey } from "@/lib/orchestrator/pipeline";
import { transitionPhase } from "@/lib/db/phases";
import { finalizePhaseArtifacts } from "@/lib/db/artifacts";
import { decidePhaseGate, decideReview, countOpenFieldReviews } from "@/lib/db/reviews";

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

/** Revalidate the engagement route (used by the chat copilot after an action). */
export async function refreshEngagementAction(engagementId: string): Promise<void> {
  await authed(engagementId);
  revalidatePath(`/engagements/${engagementId}`);
}
