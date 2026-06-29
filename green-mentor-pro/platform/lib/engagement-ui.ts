// Client-safe mirror of the engine's phase model. We deliberately do NOT import
// @gm/orchestrator here — it pulls the service-role admin client + node modules
// that must never reach the browser. The 8-phase pipeline is a strictly linear
// DAG, so runnability is just "previous phase complete + self idle".

export type PhaseKey =
  | "kickoff"
  | "materiality"
  | "data_requirements"
  | "data_collection"
  | "data_validation"
  | "calculation"
  | "report_drafting"
  | "publication";

export type PhaseStatus =
  | "not_started"
  | "agent_running"
  | "awaiting_human_review"
  | "changes_requested"
  | "approved"
  | "complete"
  | "failed";

export const PHASE_ORDER: PhaseKey[] = [
  "kickoff",
  "materiality",
  "data_requirements",
  "data_collection",
  "data_validation",
  "calculation",
  "report_drafting",
  "publication",
];

export const PHASE_LABEL: Record<PhaseKey, string> = {
  kickoff: "Kickoff & Scoping",
  materiality: "Materiality",
  data_requirements: "Data Requirements",
  data_collection: "Data Collection",
  data_validation: "Data Validation",
  calculation: "Calculation & Metrics",
  report_drafting: "Report Drafting",
  publication: "Finalization & Publishing",
};

export function isRunnable(phase: PhaseKey, states: Record<PhaseKey, PhaseStatus>): boolean {
  const i = PHASE_ORDER.indexOf(phase);
  const self = states[phase];
  const selfIdle = self === "not_started" || self === "changes_requested" || self === "failed";
  const depComplete = i === 0 || states[PHASE_ORDER[i - 1]] === "complete";
  return selfIdle && depComplete;
}

export const STATUS_TONE: Record<PhaseStatus, { label: string; tone: "green" | "teal" | "warn" | "danger" | "neutral" }> = {
  not_started: { label: "Not started", tone: "neutral" },
  agent_running: { label: "Running…", tone: "teal" },
  awaiting_human_review: { label: "Awaiting review", tone: "warn" },
  changes_requested: { label: "Changes requested", tone: "warn" },
  approved: { label: "Approved", tone: "green" },
  complete: { label: "Complete", tone: "green" },
  failed: { label: "Failed", tone: "danger" },
};
