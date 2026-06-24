/**
 * Lightweight TypeScript shapes for each phase's artifact payload, mirroring
 * agents/<key>/io.schema.json ($defs.output). EVERY field is optional on purpose:
 * these are LLM-emitted artifacts and the real demo payload (cachedArtifacts.json)
 * omits optional fields and emits all-null scope totals. Optionality forces the
 * views to read defensively at compile time.
 */
import type { Confidence } from "./theme";

export type Provenance = {
  ef_id?: string | null;
  ef_value?: number | null;
  ef_numerator_unit?: string | null;
  ef_denominator_unit?: string | null;
  source_organization?: string | null;
  reference_year?: number | null;
  calculation_method?: string | null;
  gwp_basis?: string | null;
  unit_conversion?: string | null;
  input_source_snippet?: string | null;
  formula?: string | null;
};

export type ProvenanceField = {
  value?: string | number | boolean | null;
  source_snippet?: string | null;
  extraction_confidence?: Confidence;
  extraction_note?: string | null;
};

/* 1 — kickoff: scope_plan */
export interface KickoffArtifact {
  scope_charter?: {
    objectives?: string[];
    frameworks_in_scope?: { framework?: string; rationale?: string; mandatory?: boolean }[];
    reporting_boundary?: string;
    out_of_scope?: string[];
  };
  project_plan?: {
    phase_no?: number;
    phase?: string;
    milestone?: string;
    target_date?: string | null;
    depends_on?: number[];
  }[];
  raci_matrix?: {
    activity?: string;
    responsible?: string;
    accountable?: string;
    consulted?: string | null;
    informed?: string | null;
  }[];
  open_questions?: string[];
}

/* 2 — materiality: materiality_matrix */
export interface ScoredTopic {
  topic_id?: string;
  label?: string;
  impact_score?: number;
  financial_score?: number;
  rationale?: string;
  likely_disclosures?: string[];
}
export interface MaterialityArtifact {
  questionnaire?: { topic_id?: string; question?: string; audience?: string }[] | null;
  scored_topics?: ScoredTopic[];
  material_topics?: { topic_id?: string; label?: string; rank?: number; status?: string }[];
  materiality_threshold?: number;
}

/* 3 — data_requirements: data_request_list */
export interface DataRequest {
  request_id?: string;
  dp_id?: string;
  label?: string;
  metric_ids?: string[];
  disclosure_codes?: string[];
  unit?: string;
  granularity?: string;
  sites?: string[];
  period?: string;
  data_definition?: string;
  calc_methodology?: string;
  evidence_required?: string[];
  source_system?: string | null;
  owner_role?: string | null;
  channel?: string;
  form_schema_ref?: string | null;
  deadline?: string | null;
  quality_params?: { expected_min?: number | null; outlier_factor?: number; required?: boolean };
  status?: string;
}
export interface FormSchema {
  form_schema_ref?: string;
  request_id?: string;
  title?: string;
  fields?: {
    type?: string;
    name?: string;
    label?: string;
    unit?: string | null;
    min?: number | null;
    enum?: string[];
    required?: boolean;
  }[];
}
export interface DataRequirementsArtifact {
  requests?: DataRequest[];
  form_schemas?: FormSchema[];
  unmapped_topics?: { topic_id?: string; reason?: string }[];
  coverage_note?: string;
}

/* 4 — data_collection: dataset */
export interface DatasetRow {
  request_id?: string | null;
  metric_code?: string;
  disclosure_code?: string | null;
  site_id?: string;
  period_start?: ProvenanceField;
  period_end?: ProvenanceField;
  reported_value?: ProvenanceField;
  reported_unit?: ProvenanceField;
  normalized_value?: number | null;
  normalized_unit?: string | null;
  activity_descriptor?: ProvenanceField;
  unit_mismatch?: boolean;
  period_mismatch?: boolean;
  is_outlier?: boolean;
  outlier_note?: string | null;
  overall_confidence?: Confidence;
  review_status?: string;
}
export interface DataCollectionArtifact {
  document_type_detected?: string;
  dataset_rows?: DatasetRow[];
  qualitative_capture?: { disclosure_code?: string | null; summary?: string; evidence_ref?: string; coverage_note?: string | null }[];
  fulfillment?: { request_id?: string; status?: string; reason?: string | null }[];
  followups?: { request_id?: string; data_owner?: string; channel?: string; subject?: string; message?: string }[];
  coverage_pct?: number;
  run_confidence?: Confidence;
}

/* 5 — data_validation: validation_report */
export type Severity = "info" | "low" | "medium" | "high" | "critical";
export interface ValidationIssue {
  issue_id?: string;
  metric_code?: string;
  site_id?: string | null;
  row_ref?: string | null;
  check?: string;
  finding?: string;
  severity?: Severity;
  suggested_fix?: string;
  confidence?: Confidence;
  evidence?: { row_ref?: string; source_snippet?: string | null }[];
  route_to_human?: boolean;
}
export interface ValidationArtifact {
  verdict?: "pass" | "pass_with_warnings" | "fail";
  data_quality_score?: number;
  check_results?: { check?: string; scope?: string; status?: "pass" | "warn" | "fail" | "not_applicable"; detail?: string | null }[];
  issues?: ValidationIssue[];
  gaps?: { metric_code?: string; site_id?: string | null; reason?: string }[];
  yoy_summary?: { metric_code?: string; site_id?: string | null; current?: number | null; prior?: number | null; yoy_change_pct?: number | null; flagged?: boolean }[];
  assumptions?: string[];
  limitations?: string[];
  human_queue?: { issue_id?: string; why?: string }[];
  data_owner_queries?: { issue_id?: string; data_owner?: string; question?: string }[];
}

/* 6 — calculation: calc_result */
export interface EmissionResult {
  row_ref?: string;
  metric_code?: string;
  ghg_scope?: "1" | "2" | "3" | null;
  site_id?: string;
  quantity?: number;
  unit?: string;
  total_co2e_kg?: number | null;
  co2_kg?: number | null;
  ch4_kg?: number | null;
  n2o_kg?: number | null;
  scope2_basis?: string | null;
  provenance?: Provenance;
  calc_confidence?: Confidence;
  status?: "calculated" | "unresolved";
  route_to_human?: boolean;
}
export interface Kpi {
  kpi_code?: string;
  label?: string;
  value?: number | null;
  unit?: string;
  normalization_basis?: string | null;
  yoy_change_pct?: number | null;
  vs_target_pct?: number | null;
  target_status?: "on_track" | "off_track" | "achieved" | null;
  benchmark_position?: "below_peer" | "at_peer" | "above_peer" | null;
  provenance?: Provenance;
  calc_confidence?: Confidence;
}
export interface DisclosureMapping {
  framework?: "BRSR" | "GRI" | "ESRS" | "ISSB" | "TCFD";
  disclosure_code?: string;
  question_id?: string | null;
  answer?: string | number | null;
  unit?: string | null;
  comment?: string | null;
  note?: string | null;
  provenance?: Provenance;
  status?: "mapped" | "unresolved";
}
export interface CalculationArtifact {
  emission_results?: EmissionResult[];
  scope_totals?: {
    scope1_co2e_kg?: number | null;
    scope2_location_co2e_kg?: number | null;
    scope2_market_co2e_kg?: number | null;
    scope3_co2e_kg?: number | null;
  };
  kpis?: Kpi[];
  disclosure_mappings?: DisclosureMapping[];
  trends?: string[];
  risks_opportunities?: string[];
  human_queue?: { row_ref?: string; reason?: string }[];
  run_confidence?: Confidence;
}

/* 7 — report_drafting: report_section + disclosure_draft */
export interface ReportDraftingArtifact {
  report_outline?: { section_id?: string; title?: string; order?: number }[];
  report_sections?: { section_id?: string; title?: string; body_markdown?: string; chart_refs?: string[]; data_refs?: string[] }[];
  disclosure_drafts?: { disclosure_code?: string; question_id?: string | null; answer?: string; comment?: string | null; note?: string | null; status?: "Pending" | "Drafted" }[];
  qa_notes?: string[];
}

/* 8 — publication: report_section */
export interface PublicationArtifact {
  final_sections?: { section_id?: string; title?: string; body_markdown?: string }[];
  consistency_issues?: { where?: string; finding?: string; severity?: "info" | "warning" | "error" }[];
  investor_summary?: {
    headline_metrics?: { label?: string; value?: string | number; unit?: string | null; period?: string | null; yoy_change?: string | null }[];
    highlights?: string[];
  };
  publication_checklist?: { item?: string; done?: boolean }[];
}
