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

function toActivityRows(rows: any[], includeFallback = true): any[] {
  const fromLive = (rows ?? []).map((r) => ({
    activity: r.metric_code, metric_code: r.metric_code,
    value: r.reported_value?.value ?? r.reported_value,
    unit: r.reported_unit?.value ?? r.reported_unit,
    site_id: r.site_id, country_iso: "IN",
    period: r.period_label ?? REPORTING_PERIOD.label,
    scope: r.metric_code?.includes("electricity") ? "2" : r.metric_code?.includes("diesel") ? "1" : null,
  }));
  if (!includeFallback) return fromLive;
  const liveCodes = new Set(fromLive.map((r) => r.metric_code));
  const extra = PRECOLLECTED_ROWS.filter((r) => !liveCodes.has(r.metric_code)).map((r) => ({
    activity: r.metric_code, metric_code: r.metric_code, value: r.reported_value.value,
    unit: r.reported_unit.value, site_id: r.site_id, country_iso: "IN",
    period: r.period_label, scope: r.metric_code.includes("diesel") ? "1" : null,
  }));
  return [...fromLive, ...extra];
}

/* ---- "My data" mode: build the collection input from uploaded+parsed docs ---- */

interface DocEntry {
  name?: string;
  parse_status?: string;
  markdown?: string;
}

/** Documents on the engagement that EFDB successfully parsed to markdown. */
export function parsedDocuments(engagement: EsgEngagement): DocEntry[] {
  const docs = ((engagement.config ?? {}).documents as DocEntry[]) ?? [];
  return docs.filter((d) => d?.parse_status === "parsed" && (d.markdown ?? "").trim().length > 0);
}

/** A broad BRSR field catalog the agent uses to know which metrics to look for. */
const USER_FIELD_CATALOG = [
  { metric_code: "energy.electricity.grid", label: "Grid electricity consumption", data_type: "number", required_unit: "kWh", disclosure_code: "BRSR:P6-E7", expected_magnitude: 50000 },
  { metric_code: "energy.electricity.renewable", label: "Renewable electricity consumption", data_type: "number", required_unit: "kWh", disclosure_code: "BRSR:P6-E7", expected_magnitude: 10000 },
  { metric_code: "energy.diesel", label: "Diesel (DG sets / vehicles)", data_type: "number", required_unit: "litres", disclosure_code: "BRSR:P6-E7", expected_magnitude: 12000 },
  { metric_code: "energy.natural_gas", label: "Natural gas / PNG", data_type: "number", required_unit: "scm", disclosure_code: "BRSR:P6-E7", expected_magnitude: 8000 },
  { metric_code: "energy.lpg", label: "LPG", data_type: "number", required_unit: "kg", disclosure_code: "BRSR:P6-E7", expected_magnitude: 2000 },
  { metric_code: "water.municipal", label: "Municipal / third-party water", data_type: "number", required_unit: "kL", disclosure_code: "BRSR:P6-E3", expected_magnitude: 3000 },
  { metric_code: "water.groundwater", label: "Groundwater withdrawal", data_type: "number", required_unit: "kL", disclosure_code: "BRSR:P6-E3", expected_magnitude: 2000 },
  { metric_code: "waste.hazardous", label: "Hazardous waste generated", data_type: "number", required_unit: "tonnes", disclosure_code: "BRSR:P6-E9", expected_magnitude: 50 },
  { metric_code: "waste.non_hazardous", label: "Non-hazardous waste generated", data_type: "number", required_unit: "tonnes", disclosure_code: "BRSR:P6-E9", expected_magnitude: 200 },
  { metric_code: "billing.period_start", label: "Period start", data_type: "date" },
  { metric_code: "billing.period_end", label: "Period end", data_type: "date" },
];

/** Concatenate parsed-document markdown into one extraction corpus. */
function buildUserCollectionInput(engagement: EsgEngagement, financial_year: string): any {
  const docs = parsedDocuments(engagement);
  const document_text = docs
    .map((d) => `--- ${d.name ?? "document"} ---\n${d.markdown}`)
    .join("\n\n");
  const sites = c<any[]>(engagement, "sites", SITES);
  const s0 = sites?.[0] ?? {};
  return {
    org_id: engagement.org_id,
    tenant_id: engagement.org_id,
    engagement_id: engagement.id,
    financial_year,
    quarter: null,
    site: { site_id: s0.site_id ?? "site_1", site_name: s0.name ?? s0.site_name ?? "Site 1" },
    field_catalog: USER_FIELD_CATALOG,
    data_request_list: [],
    document: { document_hint: "user_upload", uploaded_by: "user", source_documents: docs.map((d) => d.name ?? "document") },
    document_text,
  };
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
  // "demo" → hardcoded fixtures (default); "user" → uploaded+parsed documents only.
  const mode = c<"demo" | "user">(engagement, "data_source_mode", "demo");
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
          // Confirmed answers to open questions raised on a prior pass (set by the
          // "Apply answers & re-run" action). Empty on a first run.
          clarifications: c<any[]>(engagement, "kickoff_clarifications", []),
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
      // user mode → extract from the engagement's uploaded+parsed documents only.
      if (mode === "user") {
        return { sourceArtifactIds: ids, input: buildUserCollectionInput(engagement, financial_year) };
      }
      // demo mode → config-supplied collection input, else the sample-bill showcase input.
      const override = (engagement.config ?? {}).collection_input;
      return { sourceArtifactIds: ids, input: override ?? buildCollectionInput() };
    }

    case "data_validation": {
      const live = dep("data_collection").dataset_rows ?? [];
      const liveCodes = new Set(live.map((r: any) => r.metric_code));
      // user mode → validate only the user's collected rows (no demo fallback rows).
      const dataset_rows =
        mode === "user"
          ? live
          : [...live, ...PRECOLLECTED_ROWS.filter((r) => !liveCodes.has(r.metric_code))];
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
          // user mode → only the user's rows; demo mode → merge precollected extras.
          activity_rows: toActivityRows(rows, mode !== "user"),
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
