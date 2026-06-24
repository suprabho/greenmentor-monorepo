/**
 * Drive an engagement through its next runnable phase from the CLI.
 *
 *   tsx scripts/advance-phase.ts <engagementId> [--approve]
 *
 * Runs the next runnable phase (real Claude call + DB persistence). With --approve,
 * also approves the phase gate so the following phase becomes runnable (skips the
 * data-collection per-row queue check — use the UI for that). Requires
 * NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + ANTHROPIC_API_KEY.
 */
import { createAdminClient } from "../lib/supabase/admin";
import { getPhaseStates, setPhaseStatus } from "../lib/db/phases";
import { decidePhaseGate } from "../lib/db/reviews";
import { finalizePhaseArtifacts } from "../lib/db/artifacts";
import { nextRunnablePhase } from "../lib/orchestrator/gates";
import { runPhase } from "../lib/orchestrator/runPhase";

const DEV_USER_UUID = "00000000-0000-0000-0000-000000000001";

async function main() {
  const engagementId = process.argv[2];
  const approve = process.argv.includes("--approve");
  if (!engagementId) throw new Error("usage: tsx scripts/advance-phase.ts <engagementId> [--approve]");

  const admin = createAdminClient();
  const { data: eng, error } = await admin
    .from("esg_engagements")
    .select("org_id")
    .eq("id", engagementId)
    .single();
  if (error || !eng) throw new Error(`engagement not found: ${error?.message ?? engagementId}`);
  const orgId = eng.org_id as string;

  const states = await getPhaseStates(orgId, engagementId);
  const next = nextRunnablePhase(states);
  if (!next) {
    console.log("no runnable phase (engagement complete, blocked, or awaiting human review)");
    console.log("phase states:", JSON.stringify(states, null, 2));
    return;
  }

  console.log(`running phase: ${next} …`);
  const result = await runPhase(orgId, engagementId, next, DEV_USER_UUID);
  console.log("result:", JSON.stringify(result, null, 2));

  if (approve) {
    await finalizePhaseArtifacts(orgId, engagementId, next);
    await decidePhaseGate(orgId, engagementId, next, "approved", { reviewedBy: DEV_USER_UUID });
    await setPhaseStatus(orgId, engagementId, next, "complete");
    console.log(`approved gate for ${next} → phase complete (next phase unlocked)`);
  } else {
    console.log(`phase ${next} awaiting review — re-run with --approve to advance`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
