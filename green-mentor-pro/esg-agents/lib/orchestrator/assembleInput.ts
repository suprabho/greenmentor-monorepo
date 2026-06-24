/**
 * Server-side phase-input assembler — the DB-backed port of lib/demo/phaseInputs.ts
 * buildPhaseInput. Each phase's input is built from the engagement config + the prior
 * phases' stored artifact payloads (not client-passed state). Demo constants are used
 * only as fallbacks so a freshly created engagement with minimal config still runs.
 */
import type { PhaseKey } from "./pipeline";
import type { EsgArtifact, EsgEngagement } from "@/lib/db/types";
import {
  FRAMEWORKS, SECTOR, SITES, MATERIAL_TOPICS, REPORTING_PERIOD,
  FISCAL_YEAR_TYPE, FRAMEWORK_MAPPING, CLIENT, STAKEHOLDERS,
} from "@/lib/demo/engagement";
import { buildCollectionInput } from "@/lib/demo/collectionRunInput";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Upstream = Partial<Record<PhaseKey, EsgArtifact>>;

export interface AssembledInput {
  input: any;
  sourceArtifactIds: string[];
}

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

const METRIC_DEFS = [
  { metric_code: "energy.electricity.grid", label: "Grid electricity", unit: "kWh", data_type: "number", scope: "2", expected_magnitude: 50000 },
  { metric_code: "energy.diesel", label: "Diesel (DG sets)", unit: "litres", data_type: "number", scope: "1", expected_magnitude: 12000 },
  { metric_code: "water.municipal", label: "Municipal water", unit: "kL", data_type: "number", expected_magnitude: 3000 },
];

function toActivityRows(rows: any[]): any[] {
  const fromLive = (rows ?? []).map((r) => ({
    activity: r.metric_code, metric_code: r.metric_code,
    value: r.reported_value?.value ?? r.reported_value,
    unit: r.reported_unit?.value ?? r.reported_unit,
    site_id: r.site_id, country_iso: "IN",
    period: r.period_label ?? REPORTING_PERIOD.label,
    scope: r.metric_code?.includes("electricity") ? "2" : r.metric_code?.includes("diesel") ? "1" : null,
  }));
  const liveCodes = new Set(fromLive.map((r) => r.metric_code));
  const extra = PRECOLLECTED_ROWS.filter((r) => !liveCodes.has(r.metric_code)).map((r) => ({
    activity: r.metric_code, metric_code: r.metric_code, value: r.reported_value.value,
    unit: r.reported_unit.value, site_id: r.site_id, country_iso: "IN",
    period: r.period_label, scope: r.metric_code.includes("diesel") ? "1" : null,
  }));
  return [...fromLive, ...extra];
}

/** Read a config key off the engagement with a fallback. */
function c<T>(engagement: EsgEngagement, key: string, fallback: T): T {
  const v = (engagement.config ?? {})[key];
  return (v as T) ?? fallback;
}

export function assemblePhaseInput(
  phase: PhaseKey,
  engagement: EsgEngagement,
  upstream: Upstream,
): AssembledInput {
  const tenant_id = engagement.org_id;
  const engagement_id = engagement.id;
  const financial_year = engagement.financial_year;
  const frameworks = engagement.framework?.length ? engagement.framework : c(engagement, "frameworks", FRAMEWORKS);
  const ids: string[] = [];
  const dep = (k: PhaseKey) => {
    const a = upstream[k];
    if (a) ids.push(a.id);
    return (a?.payload ?? {}) as any;
  };

  switch (phase) {
    case "kickoff":
      return {
        sourceArtifactIds: ids,
        input: {
          tenant_id, engagement_id,
          client: c(engagement, "client", { ...CLIENT, name: engagement.client_name, legal_name: engagement.client_name }),
          candidate_frameworks: frameworks,
          reporting_period: c(engagement, "reporting_period", { fy: REPORTING_PERIOD.label, start_date: REPORTING_PERIOD.start, end_date: REPORTING_PERIOD.end }),
          sites: c(engagement, "sites", SITES),
          brief: c(engagement, "brief", `BRSR reporting engagement for ${engagement.client_name}.`),
        },
      };

    case "materiality": {
      const charter = dep("kickoff").scope_charter;
      return {
        sourceArtifactIds: ids,
        input: {
          tenant_id, engagement_id,
          sector: c(engagement, "sector", SECTOR),
          frameworks_in_scope: charter?.frameworks_in_scope ?? charter?.frameworks ?? frameworks,
          stakeholders: c(engagement, "stakeholders", STAKEHOLDERS),
          candidate_topics: c<any[]>(engagement, "material_topics", MATERIAL_TOPICS).map((t: any) => t?.label ?? t),
        },
      };
    }

    case "data_requirements": {
      const material = dep("materiality").material_topics ?? c(engagement, "material_topics", MATERIAL_TOPICS);
      return {
        sourceArtifactIds: ids,
        input: {
          tenant_id, engagement_id, financial_year,
          fiscal_year_type: c(engagement, "fiscal_year_type", FISCAL_YEAR_TYPE),
          frameworks_in_scope: frameworks,
          material_topics: material,
          framework_mapping: FRAMEWORK_MAPPING,
          sites: c(engagement, "sites", SITES),
          reporting_period: c(engagement, "reporting_period", REPORTING_PERIOD),
        },
      };
    }

    case "data_collection": {
      // v1: use a config-supplied collection input (e.g. built from uploaded docs in
      // Workstream D) or fall back to the sample-bill showcase input.
      const override = (engagement.config ?? {}).collection_input;
      return { sourceArtifactIds: ids, input: override ?? buildCollectionInput() };
    }

    case "data_validation": {
      const live = dep("data_collection").dataset_rows ?? [];
      const liveCodes = new Set(live.map((r: any) => r.metric_code));
      const dataset_rows = [...live, ...PRECOLLECTED_ROWS.filter((r) => !liveCodes.has(r.metric_code))];
      return {
        sourceArtifactIds: ids,
        input: { tenant_id, engagement_id, financial_year, metric_defs: METRIC_DEFS, dataset_rows },
      };
    }

    case "calculation": {
      const rows = dep("data_collection").dataset_rows ?? [];
      return {
        sourceArtifactIds: ids,
        input: {
          tenant_id, engagement_id, financial_year,
          frameworks_in_scope: frameworks,
          activity_rows: toActivityRows(rows),
          denominators: c(engagement, "denominators", { revenue_inr_cr: 1250, production_tonnes: 84000 }),
        },
      };
    }

    case "report_drafting":
      return {
        sourceArtifactIds: ids,
        input: {
          tenant_id, engagement_id,
          frameworks_in_scope: frameworks,
          calc_result: dep("calculation"),
          materiality_matrix: dep("materiality"),
          scope_charter: dep("kickoff").scope_charter ?? {},
        },
      };

    case "publication":
      return {
        sourceArtifactIds: ids,
        input: {
          tenant_id, engagement_id,
          report_sections: dep("report_drafting").report_sections ?? [],
          calc_result: dep("calculation"),
          signoffs: c(engagement, "signoffs", [
            { role: "management", status: "approved" },
            { role: "legal", status: "approved" },
          ]),
        },
      };
  }
}
