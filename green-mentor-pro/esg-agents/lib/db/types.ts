/**
 * Row types for the esg_* tables (supabase/migrations/0001_esg_agents.sql) and the
 * phase→artifact map. All repository functions in lib/db/* take `orgId` first and
 * filter every query by it — the service-role admin client bypasses RLS, so the
 * org_id scope is the tenant boundary.
 */
import type { PhaseKey, ArtifactType } from "@/lib/orchestrator/pipeline";
import type { PhaseStatus } from "@/lib/orchestrator/gates";

export type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;
export type RunStatus = "estimating" | "awaiting_run_confirmation" | "running" | "succeeded" | "failed";
export type ArtifactStatus = "draft" | "final" | "superseded";
export type ReviewStatus = "submitted" | "approved" | "rejected";
export type ReviewSubject = "artifact" | "field" | "disclosure" | "validation" | "phase_summary" | "open_question";
export type Confidence = "high" | "medium" | "low";

export interface EsgEngagement {
  id: string;
  org_id: string;
  client_name: string;
  financial_year: string;
  framework: string[];
  status: "active" | "paused" | "completed" | "archived";
  config: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EsgPhase {
  id: string;
  org_id: string;
  engagement_id: string;
  phase_key: PhaseKey;
  phase_no: number;
  status: PhaseStatus;
  agent_family: string;
  current_run_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EsgAgentRun {
  id: string;
  org_id: string;
  engagement_id: string;
  phase_key: PhaseKey;
  family: string;
  agent_key: string;
  input: Json;
  output: Json | null;
  status: RunStatus;
  confidence: number | null;
  model: string;
  prompt_version: string | null;
  prompt_variant: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  error: Json | null;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EsgArtifact {
  id: string;
  org_id: string;
  engagement_id: string;
  phase_key: PhaseKey;
  artifact_type: ArtifactType;
  payload: Json;
  confidence: number | null;
  provenance: Json | null;
  status: ArtifactStatus;
  version: number;
  created_by_run: string | null;
  created_at: string;
  updated_at: string;
}

export interface EsgValidation {
  id: string;
  org_id: string;
  engagement_id: string;
  artifact_id: string | null;
  check_type: string;
  severity: "info" | "warning" | "error";
  field_path: string | null;
  message: string;
  detected_value: Json | null;
  expected_hint: Json | null;
  status: "open" | "resolved" | "accepted";
  created_at: string;
}

export interface EsgReviewItem {
  id: string;
  org_id: string;
  engagement_id: string;
  phase_key: PhaseKey;
  run_id: string | null;
  subject_type: ReviewSubject;
  subject_id: string | null;
  item: string;
  ai_value: Json | null;
  confidence: number | null;
  review_required: boolean;
  status: ReviewStatus;
  feedback: string | null;
  requested_by: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Numeric confidence → label bucket (mirrors lib/orchestrator/quality.ts thresholds). */
export function confidenceLabel(score: number | null | undefined): Confidence {
  if (score == null) return "low";
  if (score >= 0.9) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

export const CONFIDENCE_SCORE: Record<Confidence, number> = { high: 0.9, medium: 0.6, low: 0.3 };

/**
 * The single artifact_type each phase persists. The whole agent output is stored as
 * the row payload (matching the demo's per-phase artifact); report_drafting's payload
 * carries BOTH report_sections and disclosure_drafts, distinguished downstream by
 * phase_key (report_drafting vs publication both use 'report_section').
 */
export const PHASE_PRIMARY_ARTIFACT: Record<PhaseKey, ArtifactType> = {
  kickoff: "scope_plan",
  materiality: "materiality_matrix",
  data_requirements: "data_request_list",
  data_collection: "dataset",
  data_validation: "validation_report",
  calculation: "calc_result",
  report_drafting: "report_section",
  publication: "report_section",
};
