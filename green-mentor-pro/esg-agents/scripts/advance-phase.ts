/**
 * Drive an engagement through its next runnable phase from the CLI.
 *
 *   tsx scripts/advance-phase.ts <engagementId>
 *
 * STUB for M1 — demonstrates the gate logic against in-memory state; wire to lib/db
 * + lib/orchestrator/runAgent once the access layer lands.
 */
import { nextRunnablePhase, gateIsClear, type PhaseStatus } from "../lib/orchestrator/gates";
import { PHASE_ORDER, type PhaseKey } from "../lib/orchestrator/pipeline";

const engagementId = process.argv[2] ?? "eng_dev";

// Example in-memory state: phase 1 complete, rest not started.
const states = Object.fromEntries(
  PHASE_ORDER.map((k, i) => [k, i === 0 ? "complete" : "not_started"]),
) as Record<PhaseKey, PhaseStatus>;

const next = nextRunnablePhase(states);
console.log(`engagement ${engagementId}: next runnable phase = ${next ?? "(none — complete or blocked)"}`);
console.log(`gate clear (0 open review items)? ${gateIsClear(0)}`);
console.log("\n(STUB) wire to runAgent(engagementId, next) + review_queue checks in M1.");
