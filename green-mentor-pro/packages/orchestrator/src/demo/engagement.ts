/**
 * Canonical demo-engagement seed, derived from config/engagement.template.json.
 * Single source of truth for the live end-to-end pipeline demo (PipelineBoard):
 * every phase's input is assembled from these constants + the prior phases' outputs.
 */
import cfg from "../config/engagement.template.json";
import frameworkMapping from "../config/framework-mapping.json";

const e = cfg.engagement;

/** Stable engagement identity (no DB in the demo — these are fixed ids). */
export const ENGAGEMENT_ID = "eng_acme_fy2526";

/** ctx passed to /api/agents/<key>/run (orchestrator scope). */
export const DEMO_CTX = {
  orgId: e.client.org_id,
  engagementId: ENGAGEMENT_ID,
  financialYear: e.reporting_period.label,
};

/** The id triplet most agent inputs require. */
export const IDS = {
  tenant_id: e.client.org_id,
  engagement_id: ENGAGEMENT_ID,
  financial_year: e.reporting_period.label,
};

export const FRAMEWORKS = e.frameworks;
export const SECTOR = e.client.sector;
export const SITES = e.sites;
export const MATERIAL_TOPICS = e.material_topics;
export const REPORTING_PERIOD = e.reporting_period;
export const FISCAL_YEAR_TYPE = e.fiscal_year_type;
export const FRAMEWORK_MAPPING = frameworkMapping.mappings;

export const CLIENT = {
  org_id: e.client.org_id,
  legal_name: e.client.legal_name,
  name: e.client.legal_name,
  sector: e.client.sector,
  listing_status: e.client.listing_status,
  listed: e.client.listing_status === "listed",
  cin: e.client.cin,
};

export const STAKEHOLDERS = [
  "employees",
  "investors & lenders",
  "SEBI / regulators",
  "local communities",
  "customers",
  "suppliers",
];
