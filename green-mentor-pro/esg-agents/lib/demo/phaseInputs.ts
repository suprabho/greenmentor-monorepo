/**
 * The pipeline cascade for the live end-to-end demo.
 *
 * `buildPhaseInput(phase, artifacts)` assembles the input for one phase's agent
 * from the demo-engagement seed (engagement.ts) plus the *approved outputs of the
 * prior phases* (artifacts). This is the output→input wiring the orchestrator would
 * do against the DB; here it runs in-memory so you can click each phase live.
 *
 * `summarizeArtifact(phase, output)` turns an agent's emitted artifact into a few
 * human bullets for the review panel. Both are deliberately defensive: a phase can
 * still run if an upstream artifact is missing (falls back to the seed) so the demo
 * never hard-blocks.
 */
import type { PhaseKey } from "@/lib/orchestrator/pipeline";
import { PHASES } from "@/lib/orchestrator/pipeline";
import {
  IDS,
  DEMO_CTX,
  FRAMEWORKS,
  SECTOR,
  SITES,
  MATERIAL_TOPICS,
  REPORTING_PERIOD,
  FISCAL_YEAR_TYPE,
  FRAMEWORK_MAPPING,
  CLIENT,
  STAKEHOLDERS,
} from "./engagement";
import { buildCollectionInput } from "./collectionRunInput";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Artifacts = Partial<Record<PhaseKey, any>>;

export const PHASE_AGENT = Object.fromEntries(
  (Object.keys(PHASES) as PhaseKey[]).map((k) => [k, PHASES[k].agentKey]),
) as Record<PhaseKey, string>;

/** Metric definitions for validation (what each collected row should look like). */
const METRIC_DEFS = [
  { metric_code: "energy.electricity.grid", label: "Grid electricity", unit: "kWh", data_type: "number", scope: "2", expected_magnitude: 50000 },
  { metric_code: "energy.diesel", label: "Diesel (DG sets)", unit: "litres", data_type: "number", scope: "1", expected_magnitude: 12000 },
  { metric_code: "water.municipal", label: "Municipal water", unit: "kL", data_type: "number", expected_magnitude: 3000 },
];

/**
 * Representative already-collected rows (diesel, water) so Validation/Calculation
 * show more than the single electricity row the live bill extraction yields. These
 * stand in for other documents collected through the portal in a real engagement.
 */
const PRECOLLECTED_ROWS = [
  {
    metric_code: "energy.diesel", site_id: "site_pune", period_label: "FY2025-26",
    reported_value: { value: 12400, source_snippet: "Diesel 12,400 Ltr — DG run-hour log, Apr-25", extraction_confidence: "medium" },
    reported_unit: { value: "litres" }, overall_confidence: "medium", is_outlier: false,
  },
  {
    metric_code: "water.municipal", site_id: "site_pune", period_label: "FY2025-26",
    reported_value: { value: 3250, source_snippet: "Water charges for 3,250 KL", extraction_confidence: "high" },
    reported_unit: { value: "kL" }, overall_confidence: "high", is_outlier: false,
  },
];

/** Map collected dataset rows → calculation activity_rows (+ static diesel/water). */
function toActivityRows(rows: any[]): any[] {
  const fromLive = rows.map((r) => ({
    activity: r.metric_code,
    metric_code: r.metric_code,
    value: r.reported_value?.value ?? r.reported_value,
    unit: r.reported_unit?.value ?? r.reported_unit,
    site_id: r.site_id,
    country_iso: "IN",
    period: r.period_label ?? REPORTING_PERIOD.label,
    scope: r.metric_code?.includes("electricity") ? "2" : r.metric_code?.includes("diesel") ? "1" : null,
  }));
  const liveCodes = new Set(fromLive.map((r) => r.metric_code));
  const extra = PRECOLLECTED_ROWS.filter((r) => !liveCodes.has(r.metric_code)).map((r) => ({
    activity: r.metric_code,
    metric_code: r.metric_code,
    value: r.reported_value.value,
    unit: r.reported_unit.value,
    site_id: r.site_id,
    country_iso: "IN",
    period: r.period_label,
    scope: r.metric_code.includes("diesel") ? "1" : null,
  }));
  return [...fromLive, ...extra];
}

export interface BuiltRun {
  agentKey: string;
  input: any;
  ctx: typeof DEMO_CTX;
}

export function buildPhaseInput(phase: PhaseKey, artifacts: Artifacts): BuiltRun {
  const ctx = DEMO_CTX;
  const agentKey = PHASE_AGENT[phase];
  const { tenant_id, engagement_id, financial_year } = IDS;

  switch (phase) {
    case "kickoff":
      return {
        agentKey, ctx,
        input: {
          tenant_id, engagement_id,
          client: CLIENT,
          candidate_frameworks: FRAMEWORKS,
          reporting_period: { fy: REPORTING_PERIOD.label, start_date: REPORTING_PERIOD.start, end_date: REPORTING_PERIOD.end },
          sites: SITES,
          brief: "First-time BRSR Core filing (plus voluntary GRI / ESRS / TCFD alignment) for a listed Indian steel manufacturer with two plants and a head office.",
        },
      };

    case "materiality": {
      const charter = artifacts.kickoff?.scope_charter;
      const frameworks = charter?.frameworks_in_scope ?? charter?.frameworks ?? FRAMEWORKS;
      return {
        agentKey, ctx,
        input: {
          tenant_id, engagement_id,
          sector: SECTOR,
          frameworks_in_scope: frameworks,
          stakeholders: STAKEHOLDERS,
          candidate_topics: MATERIAL_TOPICS.map((t: any) => t.label),
        },
      };
    }

    case "data_requirements": {
      const material = artifacts.materiality?.material_topics ?? MATERIAL_TOPICS;
      return {
        agentKey, ctx,
        input: {
          tenant_id, engagement_id, financial_year,
          fiscal_year_type: FISCAL_YEAR_TYPE,
          frameworks_in_scope: FRAMEWORKS,
          material_topics: material,
          framework_mapping: FRAMEWORK_MAPPING,
          sites: SITES,
          reporting_period: REPORTING_PERIOD,
        },
      };
    }

    case "data_collection":
      // Showcase phase: extract from the sample MSEDCL utility bill via a real Claude run.
      return { agentKey, ctx, input: buildCollectionInput() };

    case "data_validation": {
      const live = artifacts.data_collection?.dataset_rows ?? [];
      const liveCodes = new Set(live.map((r: any) => r.metric_code));
      const dataset_rows = [...live, ...PRECOLLECTED_ROWS.filter((r) => !liveCodes.has(r.metric_code))];
      return {
        agentKey, ctx,
        input: { tenant_id, engagement_id, financial_year, metric_defs: METRIC_DEFS, dataset_rows },
      };
    }

    case "calculation": {
      const rows = artifacts.data_collection?.dataset_rows ?? [];
      return {
        agentKey, ctx,
        input: {
          tenant_id, engagement_id, financial_year,
          frameworks_in_scope: FRAMEWORKS,
          activity_rows: toActivityRows(rows),
          denominators: { revenue_inr_cr: 1250, production_tonnes: 84000 },
        },
      };
    }

    case "report_drafting":
      return {
        agentKey, ctx,
        input: {
          tenant_id, engagement_id,
          frameworks_in_scope: FRAMEWORKS,
          calc_result: artifacts.calculation ?? {},
          materiality_matrix: artifacts.materiality ?? {},
          scope_charter: artifacts.kickoff?.scope_charter ?? {},
        },
      };

    case "publication":
      return {
        agentKey, ctx,
        input: {
          tenant_id, engagement_id,
          report_sections: artifacts.report_drafting?.report_sections ?? [],
          calc_result: artifacts.calculation ?? {},
          signoffs: [
            { role: "management", status: "approved" },
            { role: "legal", status: "approved" },
          ],
        },
      };
  }
}

/* ---- artifact summaries for the review panel ---- */

export interface Bullet { label: string; value: string }

const len = (x: unknown) => (Array.isArray(x) ? x.length : 0);
const list = (xs: any[], pick: (x: any) => string, n = 4) =>
  (xs ?? []).slice(0, n).map(pick).filter(Boolean).join(", ") || "—";

export function summarizeArtifact(phase: PhaseKey, o: any): Bullet[] {
  if (!o) return [];
  switch (phase) {
    case "kickoff":
      return [
        { label: "Frameworks in scope", value: list(o.scope_charter?.frameworks_in_scope ?? o.scope_charter?.frameworks ?? FRAMEWORKS, (f) => (typeof f === "string" ? f : f?.framework ?? f?.name)) },
        { label: "Project plan phases", value: String(len(o.project_plan)) },
        { label: "Open questions", value: String(len(o.open_questions)) },
      ];
    case "materiality":
      return [
        { label: "Material topics", value: String(len(o.material_topics)) },
        { label: "Top topics", value: list(o.material_topics, (t) => t?.label ?? t?.topic_id) },
        { label: "Threshold", value: o.materiality_threshold != null ? String(o.materiality_threshold) : "—" },
      ];
    case "data_requirements":
      return [
        { label: "Data requests", value: String(len(o.requests)) },
        { label: "Portal forms", value: String(len(o.form_schemas)) },
        { label: "Unmapped topics", value: String(len(o.unmapped_topics)) },
      ];
    case "data_validation":
      return [
        { label: "Verdict", value: String(o.verdict ?? "—") },
        { label: "Quality score", value: o.data_quality_score != null ? String(o.data_quality_score) : "—" },
        { label: "Issues", value: String(len(o.issues)) },
        { label: "Gaps / queries", value: String(len(o.gaps) + len(o.data_owner_queries)) },
      ];
    case "calculation": {
      const totals = o.scope_totals ?? {};
      const totalsStr = typeof totals === "object" && totals
        ? Object.entries(totals).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"
        : String(totals);
      return [
        { label: "Scope totals", value: totalsStr },
        { label: "Emission results", value: String(len(o.emission_results)) },
        { label: "KPIs", value: String(len(o.kpis)) },
        { label: "Needs review", value: String(len(o.human_queue)) },
      ];
    }
    case "report_drafting":
      return [
        { label: "Report sections", value: String(len(o.report_sections)) },
        { label: "Disclosure drafts", value: String(len(o.disclosure_drafts)) },
        { label: "Outline items", value: String(len(o.report_outline)) },
      ];
    case "publication":
      return [
        { label: "Final sections", value: String(len(o.final_sections)) },
        { label: "Headline metrics", value: list(o.investor_summary?.headline_metrics, (m) => m?.label) },
        { label: "Checklist items", value: String(len(o.publication_checklist)) },
        { label: "Consistency issues", value: String(len(o.consistency_issues)) },
      ];
    default:
      return []; // data_collection is rendered via the review queue, not summarized
  }
}
