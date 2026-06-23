import type { ToolContext } from "./types";

/**
 * Dispatch table mapping each tools.json name to a TENANT-SCOPED Supabase/EFDB call.
 * Tool inputs are already schema-valid (strict tool-use), so handlers trust the
 * shape but still enforce tenant scope server-side via `ctx`.
 *
 * search_emission_factors is wired to the EFDB FastAPI service (login → pgvector
 * semantic search, with a keyword-list fallback). Configure via env:
 *   EFDB_API_URL   (e.g. http://localhost:8000)
 *   EFDB_EMAIL / EFDB_PASSWORD   (service login for the Bearer token)
 * query_workspace_dataset / fetch_prior_artifact remain M2 stubs.
 */
type ToolHandler = (input: unknown, ctx: ToolContext) => Promise<unknown>;

/* ---- EFDB HTTP client (consulting/efdb FastAPI) ---- */

const efdbBase = () => (process.env.EFDB_API_URL || "").replace(/\/+$/, "");

// Cached JWT (EFDB tokens last ~8h). Re-login on 401.
let _token: string | null = null;

async function efdbLogin(): Promise<string | null> {
  const base = efdbBase();
  const email = process.env.EFDB_EMAIL;
  const password = process.env.EFDB_PASSWORD;
  if (!base || !email || !password) return null;
  try {
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.access_token ?? null;
  } catch {
    return null;
  }
}

interface EfdbGet { ok: boolean; status: number; body: unknown }

async function efdbGet(pathWithQuery: string): Promise<EfdbGet> {
  const base = efdbBase();
  if (!base) return { ok: false, status: 0, body: null };
  if (!_token) _token = await efdbLogin();
  if (!_token) return { ok: false, status: 401, body: null };
  const call = () => fetch(`${base}${pathWithQuery}`, { headers: { Authorization: `Bearer ${_token}` } });
  try {
    let res = await call();
    if (res.status === 401) {
      _token = await efdbLogin(); // token expired — re-login once
      if (!_token) return { ok: false, status: 401, body: null };
      res = await call();
    }
    return { ok: res.ok, status: res.status, body: await res.json().catch(() => null) };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

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

  // Disclosure requirement lookup (Phase 3/6).
  lookup_disclosure_requirement: async () => {
    return { requirement: null, note: "lookup_disclosure_requirement not yet wired (M2)" };
  },

  // Prior-phase artifact fetch (tenant + financial_year scoped).
  fetch_prior_artifact: async (_input, ctx) => {
    return { artifact: null, ctx: { orgId: ctx.orgId, engagementId: ctx.engagementId } };
  },

  // Scoped read over the workspace dataset (RLS enforced server-side).
  query_workspace_dataset: async (_input, ctx) => {
    return { rows: [], ctx: { orgId: ctx.orgId, financialYear: ctx.financialYear } };
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
