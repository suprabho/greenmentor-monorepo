import { MODELS, type AgentModel } from "@gm/agents";

export type PhaseKey =
  | "kickoff"
  | "materiality"
  | "data_requirements"
  | "data_collection"
  | "data_validation"
  | "calculation"
  | "report_drafting"
  | "publication";

export type ArtifactType =
  | "scope_plan"
  | "materiality_matrix"
  | "data_request_list"
  | "dataset"
  | "validation_report"
  | "calc_result"
  | "disclosure_draft"
  | "report_section";

export interface PhaseDef {
  key: PhaseKey;
  phaseNo: number;
  agentKey: string; // package folder under agents/
  model: AgentModel;
  dependsOn: PhaseKey[]; // must be `complete` before this can run
  outputArtifactTypes: ArtifactType[];
  hitlGate: string;
  maxTokens: number;
}

/** The 8-phase state machine, data-driven. Order is a linear DAG via dependsOn. */
export const PHASES: Record<PhaseKey, PhaseDef> = {
  kickoff: {
    key: "kickoff", phaseNo: 1, agentKey: "kickoff-scoping", model: MODELS.sonnet,
    dependsOn: [], outputArtifactTypes: ["scope_plan"], hitlGate: "scope_approval", maxTokens: 4096,
  },
  materiality: {
    key: "materiality", phaseNo: 2, agentKey: "materiality", model: MODELS.sonnet,
    dependsOn: ["kickoff"], outputArtifactTypes: ["materiality_matrix"], hitlGate: "material_topics_validated", maxTokens: 4096,
  },
  data_requirements: {
    key: "data_requirements", phaseNo: 3, agentKey: "data-requirement-planner", model: MODELS.opus,
    dependsOn: ["materiality"], outputArtifactTypes: ["data_request_list"], hitlGate: "data_request_approval", maxTokens: 8192,
  },
  data_collection: {
    key: "data_collection", phaseNo: 4, agentKey: "data-collection", model: MODELS.opus,
    dependsOn: ["data_requirements"], outputArtifactTypes: ["dataset"], hitlGate: "collection_complete", maxTokens: 8192,
  },
  data_validation: {
    key: "data_validation", phaseNo: 5, agentKey: "data-validation", model: MODELS.opus,
    dependsOn: ["data_collection"], outputArtifactTypes: ["validation_report"], hitlGate: "data_quality_signoff", maxTokens: 8192,
  },
  calculation: {
    key: "calculation", phaseNo: 6, agentKey: "calculation-metrics", model: MODELS.opus,
    dependsOn: ["data_validation"], outputArtifactTypes: ["calc_result"], hitlGate: "calculation_review", maxTokens: 8192,
  },
  report_drafting: {
    key: "report_drafting", phaseNo: 7, agentKey: "report-drafting", model: MODELS.sonnet,
    dependsOn: ["calculation"], outputArtifactTypes: ["disclosure_draft", "report_section"], hitlGate: "management_legal_review", maxTokens: 8192,
  },
  publication: {
    key: "publication", phaseNo: 8, agentKey: "finalization-publishing", model: MODELS.haiku,
    dependsOn: ["report_drafting"], outputArtifactTypes: ["report_section"], hitlGate: "board_approval", maxTokens: 4096,
  },
};

export const PHASE_ORDER: PhaseKey[] = [
  "kickoff", "materiality", "data_requirements", "data_collection",
  "data_validation", "calculation", "report_drafting", "publication",
];
