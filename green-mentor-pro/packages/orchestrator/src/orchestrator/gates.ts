import { PHASES, PHASE_ORDER, type PhaseKey } from "./pipeline";

export type PhaseStatus =
  | "not_started"
  | "agent_running"
  | "awaiting_human_review"
  | "changes_requested"
  | "approved"
  | "complete"
  | "failed";

export interface PhaseState {
  key: PhaseKey;
  status: PhaseStatus;
}

/**
 * A phase is runnable when every dependency is `complete` and it is idle. "Idle"
 * includes `failed` so a phase that errored (e.g. a transient AI overload) can be
 * retried.
 */
export function isRunnable(phase: PhaseKey, states: Record<PhaseKey, PhaseStatus>): boolean {
  const def = PHASES[phase];
  const s = states[phase];
  const selfIdle = s === "not_started" || s === "changes_requested" || s === "failed";
  const depsComplete = def.dependsOn.every((d) => states[d] === "complete");
  return selfIdle && depsComplete;
}

/** Next runnable phase in linear order, or null if none / engagement complete. */
export function nextRunnablePhase(states: Record<PhaseKey, PhaseStatus>): PhaseKey | null {
  for (const key of PHASE_ORDER) {
    if (isRunnable(key, states)) return key;
  }
  return null;
}

/** A phase advances only when there are zero `submitted` review items for it. */
export function gateIsClear(openSubmittedItems: number): boolean {
  return openSubmittedItems === 0;
}
