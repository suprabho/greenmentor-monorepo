/**
 * In-memory demo data for the M1 pipeline-board + review-panel screen.
 * Renders with no API key or Supabase — seeds an engagement parked at the
 * Phase-4 (Data Collection) human gate so the approve/reject flow is clickable.
 */
import type { PhaseKey } from "../orchestrator/pipeline";

export type DemoPhaseStatus =
  | "complete"
  | "awaiting_human_review"
  | "changes_requested"
  | "not_started";

export interface DemoEngagement {
  name: string;
  client: string;
  financialYear: string;
  frameworks: string[];
}

export interface PhaseRow {
  key: PhaseKey;
  no: number;
  label: string;
  agentKey: string;
  gate: string;
}

/** Display order + labels (kept in sync with lib/orchestrator/pipeline.ts). */
export const PHASE_ROWS: PhaseRow[] = [
  { key: "kickoff", no: 1, label: "Kick-off & Scoping", agentKey: "kickoff-scoping", gate: "scope_approval" },
  { key: "materiality", no: 2, label: "Materiality", agentKey: "materiality", gate: "material_topics_validated" },
  { key: "data_requirements", no: 3, label: "Data Requirement Planning", agentKey: "data-requirement-planner", gate: "data_request_approval" },
  { key: "data_collection", no: 4, label: "Data Collection", agentKey: "data-collection", gate: "collection_complete" },
  { key: "data_validation", no: 5, label: "Data Validation & QC", agentKey: "data-validation", gate: "data_quality_signoff" },
  { key: "calculation", no: 6, label: "Analysis & ESG Metrics", agentKey: "calculation-metrics", gate: "calculation_review" },
  { key: "report_drafting", no: 7, label: "Report Drafting", agentKey: "report-drafting", gate: "management_legal_review" },
  { key: "publication", no: 8, label: "Finalization & Publication", agentKey: "finalization-publishing", gate: "board_approval" },
];

export const DEMO_ENGAGEMENT: DemoEngagement = {
  name: "Acme Manufacturing — FY2025-26 BRSR",
  client: "Acme Manufacturing Pvt Ltd",
  financialYear: "FY2025-26",
  frameworks: ["BRSR", "GRI", "ESRS", "TCFD"],
};

export const INITIAL_PHASE_STATUS: Record<PhaseKey, DemoPhaseStatus> = {
  kickoff: "complete",
  materiality: "complete",
  data_requirements: "complete",
  data_collection: "awaiting_human_review",
  data_validation: "not_started",
  calculation: "not_started",
  report_drafting: "not_started",
  publication: "not_started",
};

export type Confidence = "high" | "medium" | "low";
export type ReviewStatus = "submitted" | "approved" | "rejected";

export interface ReviewItem {
  id: string;
  item: string;
  site: string;
  value: number;
  unit: string;
  confidence: Confidence;
  sourceSnippet: string;
  reviewRequired: boolean; // low-confidence or outlier — sorted to top
  note?: string;
  status: ReviewStatus;
  feedback?: string;
}

/** A kickoff scoping question that must be answered or waived before scope approval. */
export interface OpenQuestionReview {
  id: string;
  question: string;
  answer?: string;
  waived: boolean;
  status: ReviewStatus; // "submitted" = unanswered, "approved" = answered/waived
}

/**
 * The Phase-4 data-collection agent's draft, fanned out as review-queue items.
 * One is a flagged outlier (>3x median) + low confidence to show the routing.
 */
export const INITIAL_REVIEW_ITEMS: ReviewItem[] = [
  {
    id: "rq_chn_elec",
    item: "Grid electricity — Scope 2",
    site: "Chennai Plant",
    value: 512000,
    unit: "kWh",
    confidence: "low",
    sourceSnippet: "Units 5,12,000 (handwritten correction over printed value)",
    reviewRequired: true,
    note: "Anomaly: 5.7× the median monthly draw across sites (>3× rule). Confirm the figure & unit.",
    status: "submitted",
  },
  {
    id: "rq_pune_diesel",
    item: "Diesel (DG sets) — Scope 1",
    site: "Pune Plant",
    value: 12400,
    unit: "litres",
    confidence: "medium",
    sourceSnippet: "Diesel 12,400 Ltr — DG run-hour log, Apr-25",
    reviewRequired: false,
    note: "Unit read as litres; invoice not attached — medium confidence.",
    status: "submitted",
  },
  {
    id: "rq_pune_elec",
    item: "Grid electricity — Scope 2",
    site: "Pune Plant",
    value: 48210,
    unit: "kWh",
    confidence: "high",
    sourceSnippet: "Total units consumed 48,210 kWh",
    reviewRequired: false,
    status: "submitted",
  },
  {
    id: "rq_pune_water",
    item: "Water withdrawal (municipal)",
    site: "Pune Plant",
    value: 3250,
    unit: "kL",
    confidence: "high",
    sourceSnippet: "Water charges for 3,250 KL",
    reviewRequired: false,
    status: "submitted",
  },
];
