import { createAdminClient } from "../admin";
import { PHASES, PHASE_ORDER, type PhaseKey } from "../orchestrator/pipeline";
import type { PhaseStatus } from "../orchestrator/gates";
import type { EsgPhase } from "./types";

/** All phase rows for an engagement, ordered by phase_no. */
export async function listPhases(orgId: string, engagementId: string): Promise<EsgPhase[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("esg_engagement_phases")
    .select("*")
    .eq("org_id", orgId)
    .eq("engagement_id", engagementId)
    .order("phase_no", { ascending: true });
  if (error) throw new Error(`listPhases: ${error.message}`);
  return (data ?? []) as EsgPhase[];
}

/** Phase → status map shaped for lib/orchestrator/gates.ts (isRunnable / nextRunnablePhase). */
export async function getPhaseStates(
  orgId: string,
  engagementId: string,
): Promise<Record<PhaseKey, PhaseStatus>> {
  const rows = await listPhases(orgId, engagementId);
  const map = Object.fromEntries(PHASE_ORDER.map((k) => [k, "not_started"])) as Record<PhaseKey, PhaseStatus>;
  for (const r of rows) map[r.phase_key] = r.status;
  return map;
}

export async function setPhaseStatus(
  orgId: string,
  engagementId: string,
  phaseKey: PhaseKey,
  status: PhaseStatus,
  patch: { currentRunId?: string | null } = {},
): Promise<void> {
  const admin = createAdminClient();
  const update: Record<string, unknown> = { status };
  if ("currentRunId" in patch) update.current_run_id = patch.currentRunId;
  const { error } = await admin
    .from("esg_engagement_phases")
    .update(update)
    .eq("org_id", orgId)
    .eq("engagement_id", engagementId)
    .eq("phase_key", phaseKey);
  if (error) throw new Error(`setPhaseStatus: ${error.message}`);
}

/**
 * Guarded transition: only flips status when the current value is one of `from`.
 * Returns true if a row was changed, false if it was already in another state
 * (the concurrency / double-run guard).
 */
export async function transitionPhase(
  orgId: string,
  engagementId: string,
  phaseKey: PhaseKey,
  from: PhaseStatus | PhaseStatus[],
  to: PhaseStatus,
  patch: { currentRunId?: string | null } = {},
): Promise<boolean> {
  const admin = createAdminClient();
  const fromList = Array.isArray(from) ? from : [from];
  const update: Record<string, unknown> = { status: to };
  if ("currentRunId" in patch) update.current_run_id = patch.currentRunId;
  const { data, error } = await admin
    .from("esg_engagement_phases")
    .update(update)
    .eq("org_id", orgId)
    .eq("engagement_id", engagementId)
    .eq("phase_key", phaseKey)
    .in("status", fromList)
    .select("id");
  if (error) throw new Error(`transitionPhase: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * Reset every phase strictly downstream of `fromPhase` back to not_started — called
 * after a (re-)run so stale downstream artifacts can't survive an upstream change.
 * A no-op on a first run (downstream is already not_started).
 */
export async function cascadeStaleDownstream(
  orgId: string,
  engagementId: string,
  fromPhase: PhaseKey,
): Promise<void> {
  const fromNo = PHASES[fromPhase].phaseNo;
  const downstream = PHASE_ORDER.filter((k) => PHASES[k].phaseNo > fromNo);
  if (!downstream.length) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from("esg_engagement_phases")
    .update({ status: "not_started", current_run_id: null })
    .eq("org_id", orgId)
    .eq("engagement_id", engagementId)
    .in("phase_key", downstream)
    .neq("status", "not_started");
  if (error) throw new Error(`cascadeStaleDownstream: ${error.message}`);
}
