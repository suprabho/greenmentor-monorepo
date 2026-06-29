import type { ToolContext } from "@gm/agents";
import { getLatestArtifact } from "./db/artifacts";
import { queryDataset } from "./db/dataCollection";
import { createAdminClient } from "./admin";
import { PHASE_PRIMARY_ARTIFACT } from "./db/types";
import { PHASE_ORDER, type PhaseKey } from "./orchestrator/pipeline";
import { efdbBase, efdbGet } from "./efdb/client";

/** Tools that touch the DB no-op on demo ctx (org_dev/eng_dev are not uuids). */
const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/**
 * Dispatch table mapping each tools.json name to a TENANT-SCOPED Supabase/EFDB call.
 * Tool inputs are already schema-valid (strict tool-use), so handlers trust the
 * shape but still enforce tenant scope server-side via `ctx`.
 *
 * search_emission_factors is wired to the EFDB FastAPI service (login → pgvector
 * semantic search, with a keyword-list fallback) via the shared client in
 * lib/efdb/client.ts. Configure via env:
 *   EFDB_API_URL   (e.g. http://localhost:8000)
 *   EFDB_EMAIL / EFDB_PASSWORD   (service login for the Bearer token)
 * query_workspace_dataset / fetch_prior_artifact remain M2 stubs.
 */
type ToolHandler = (input: unknown, ctx: ToolContext) => Promise<unknown>;

/* eslint-disable @typescript-eslint/no-explicit-any */
// Generic words that add no signal as a keyword query against EFDB activity names.
const STOPWORDS = new Set([
  "consumption", "total", "annual", "monthly", "based", "scope", "emission",
  "emissions", "data", "value", "usage", "amount", "quantity",
]);
const extractRows = (body: any): any[] =>
  Array.isArray(body) ? body : body?.results ?? body?.items ?? body?.data ?? body?.records ?? [];

function mapEf(raw: any) {
  const r = raw?.emission_factor ?? raw?.record ?? raw;
  return {
    ef_id: r?.ef_id ?? r?.id ?? null,
    activity: r?.activity_name ?? r?.canonical_activity_name ?? null,
    ef_value: r?.ef_value ?? r?.ef_total_co2e ?? null,
    ef_numerator_unit: r?.numerator_unit ?? null,
    ef_denominator_unit: r?.denominator_unit ?? null,
    ghg_scope: r?.ghg_scope ?? null,
    ghg_species: r?.ghg_species ?? null,
    country: r?.country_iso ?? null,
    reference_year: r?.reference_year ?? null,
    source_organization: r?.source_organization ?? null,
    source_url: r?.source_url ?? null,
    gwp_basis: r?.gwp_basis ?? null,
    dq_score: r?.dq_score_overall ?? r?.confidence_score ?? null, // pedigree data quality
    status: r?.status ?? null,
  };
}

const HANDLERS: Record<string, ToolHandler> = {
  // EFDB — emission-factor lookup (Phase 6). Hits the EFDB FastAPI service: pgvector
  // semantic search first, then the keyword list endpoint as a fallback. Returns
  // ranked candidates in the provenance shape the calculation agent expects.
  search_emission_factors: async (input) => {
    const { activity_query, country_iso, year, ghg_scope } = (input ?? {}) as {
      activity_query?: string; country_iso?: string | null; year?: number | null; ghg_scope?: string | null;
    };
    if (!efdbBase()) {
      return { candidates: [], note: "EFDB not configured — set EFDB_API_URL (+ EFDB_EMAIL/EFDB_PASSWORD) in .env.local" };
    }
    const phrase = (activity_query ?? "").trim();
    if (phrase.length < 2) return { candidates: [], note: "activity_query too short for EFDB search" };

    // EFDB activity names rarely contain a full phrase, and the data is country-sparse,
    // so query the keyword endpoint per significant word (trigram match) and merge —
    // no country/scope filter (the calc agent picks by each candidate's own country /
    // scope / units). pgvector semantic is a last-resort fallback only.
    const words = phrase.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w)).slice(0, 4);
    const queries = words.length ? words : [phrase];

    const seen = new Map<string, any>();
    let reachErr = false;
    for (const w of queries) {
      const r = await efdbGet(`/emission-factors?q=${encodeURIComponent(w)}&page_size=8`);
      if (r.status === 401) return { candidates: [], note: "EFDB auth failed — check EFDB_EMAIL / EFDB_PASSWORD" };
      if (r.status === 0) { reachErr = true; break; }
      for (const row of extractRows(r.body)) {
        const key = String(row.ef_id ?? row.id ?? `${row.activity_name}|${row.ef_value}|${row.numerator_unit}`);
        if (!seen.has(key)) seen.set(key, row);
      }
      if (seen.size >= 12) break;
    }
    if (reachErr && !seen.size) {
      return { candidates: [], note: "EFDB unreachable — check EFDB_API_URL / that the service is up" };
    }

    // Last resort: pgvector nearest-neighbour (lower precision) if no keyword matched.
    if (!seen.size) {
      const sem = await efdbGet(`/emission-factors/search/semantic?q=${encodeURIComponent(phrase)}&limit=8`);
      for (const row of extractRows(sem.body)) {
        const key = String(row.ef_id ?? row.id ?? row.activity_name);
        if (!seen.has(key)) seen.set(key, row);
      }
    }

    const candidates = [...seen.values()].slice(0, 8).map(mapEf);
    return {
      candidates,
      count: candidates.length,
      query: { activity_query: phrase, country_iso: country_iso ?? null, year: year ?? null, ghg_scope: ghg_scope ?? null },
      note: candidates.length ? undefined : "No matching emission factors found in EFDB",
    };
  },

  // Disclosure requirement lookup (Phase 3/6). Static config-backed (no DB).
  lookup_disclosure_requirement: async () => {
    return { requirement: null, note: "lookup_disclosure_requirement not yet wired" };
  },

  // Prior-phase artifact fetch — reads the latest non-superseded artifact for the
  // engagement, by phase_key (preferred) or a known artifact_type. Tenant-scoped.
  fetch_prior_artifact: async (input, ctx) => {
    if (!isUuid(ctx.orgId) || !isUuid(ctx.engagementId)) {
      return { artifact: null, note: "no persisted context (demo run)" };
    }
    const { artifact_type, phase_key } = (input ?? {}) as { artifact_type?: string; phase_key?: string };
    let phase = phase_key as PhaseKey | undefined;
    if (!phase && artifact_type) phase = PHASE_ORDER.find((k) => PHASE_PRIMARY_ARTIFACT[k] === artifact_type);
    if (!phase) return { artifact: null, note: "specify phase_key or a known artifact_type" };
    try {
      const a = await getLatestArtifact(ctx.orgId, ctx.engagementId, phase);
      return a ? { artifact: a.payload, version: a.version, confidence: a.confidence } : { artifact: null };
    } catch (e) {
      return { artifact: null, error: e instanceof Error ? e.message : String(e) };
    }
  },

  // Scoped read over the collected dataset (latest 'dataset' artifact rows).
  query_workspace_dataset: async (input, ctx) => {
    if (!isUuid(ctx.orgId) || !isUuid(ctx.engagementId)) {
      return { rows: [], count: 0, note: "no persisted context (demo run)" };
    }
    const { metric_codes, site_ids } = (input ?? {}) as { metric_codes?: string[]; site_ids?: string[] };
    try {
      return await queryDataset(ctx.orgId, ctx.engagementId, { metricCodes: metric_codes, siteIds: site_ids });
    } catch (e) {
      return { rows: [], count: 0, error: e instanceof Error ? e.message : String(e) };
    }
  },

  // Data-validation raises a precise question for a data owner → persists a
  // validation gap + a human-review row (subject_type 'validation').
  raise_data_owner_query: async (input, ctx) => {
    const q = (input ?? {}) as {
      issue_id?: string; data_owner?: string; metric_code?: string;
      site_id?: string; question?: string; needs_evidence?: boolean;
    };
    const question = q.question ?? `Clarify ${q.metric_code ?? "a data point"}`;
    if (!isUuid(ctx.orgId) || !isUuid(ctx.engagementId)) {
      return { queued: false, note: "no persisted context (demo run)", question };
    }
    try {
      const admin = createAdminClient();
      await admin.from("esg_validations").insert({
        org_id: ctx.orgId, engagement_id: ctx.engagementId, check_type: "gap",
        severity: "warning", field_path: q.metric_code ?? null, message: question, status: "open",
      });
      const { data } = await admin
        .from("esg_review_queue")
        .insert({
          org_id: ctx.orgId, engagement_id: ctx.engagementId, phase_key: "data_validation",
          subject_type: "validation", item: question,
          ai_value: { data_owner: q.data_owner ?? null, metric_code: q.metric_code ?? null, site_id: q.site_id ?? null, needs_evidence: q.needs_evidence ?? false },
          review_required: true, status: "submitted",
        })
        .select("id")
        .single();
      return { queued: true, query_id: data?.id ?? null };
    } catch (e) {
      return { queued: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export async function runCallableTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<unknown> {
  const handler = HANDLERS[name];
  if (!handler) {
    // The agent may only call tools declared in its package; an unknown name is a bug.
    return { error: `No handler registered for tool "${name}"` };
  }
  return handler(input, ctx);
}
