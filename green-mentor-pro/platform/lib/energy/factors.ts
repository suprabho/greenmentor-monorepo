// Emission-factor resolution for Energy entries. Thin wrapper over the EFDB
// FastAPI service (consulting/efdb) via @gm/orchestrator's efdbGet — the same
// seam the calculation agent's search_emission_factors tool uses, but called
// deterministically from our server routes (no LLM in the loop).
//
// Resolution order for a row's factor:
//   1. user-supplied manual override  → { ef, source: 'manual' }
//   2. EFDB best candidate            → { ef, source: 'efdb', provenance }
//   3. nothing found                  → { ef: null, source: 'none' }  (row still saved,
//                                        tCO2e left null until an EF is populated)

import { efdbGet, efdbBase } from "@gm/orchestrator";
import type { EfProvenance } from "./types";

const STOPWORDS = new Set([
  "consumption", "total", "annual", "monthly", "based", "scope", "emission",
  "emissions", "data", "value", "usage", "amount", "quantity", "fuel", "energy",
]);

function extractRows(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  const b = body as Record<string, unknown> | null;
  const arr = b?.results ?? b?.items ?? b?.data ?? b?.records;
  return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : [];
}

function toProvenance(raw: Record<string, unknown>): EfProvenance {
  const r = (raw.emission_factor ?? raw.record ?? raw) as Record<string, unknown>;
  const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
  return {
    ef_id: (r.ef_id ?? r.id ?? null) as string | null,
    activity: (r.activity_name ?? r.canonical_activity_name ?? null) as string | null,
    ef_value: num(r.ef_value ?? r.ef_total_co2e),
    numerator_unit: (r.numerator_unit ?? null) as string | null,
    denominator_unit: (r.denominator_unit ?? null) as string | null,
    ghg_scope: (r.ghg_scope ?? null) as string | null,
    country: (r.country_iso ?? null) as string | null,
    reference_year: num(r.reference_year),
    source_organization: (r.source_organization ?? null) as string | null,
    dq_score: num(r.dq_score_overall ?? r.confidence_score),
  };
}

export interface ResolvedFactor {
  ef: number | null;
  source: "manual" | "efdb" | "none";
  provenance: EfProvenance | null;
  note?: string;
}

export interface FactorQuery {
  query: string;
  scope: 1 | 2;
  country?: string | null;
  manualEf?: number | null;
}

/**
 * Resolve the emission factor for an entry. A finite manualEf always wins.
 * Otherwise query EFDB per significant word (its activity names rarely contain a
 * full phrase and the data is country-sparse — same approach as toolHandlers),
 * then pick the best candidate: prefer a country match, then highest data-quality.
 */
export async function resolveFactor(q: FactorQuery): Promise<ResolvedFactor> {
  if (q.manualEf != null && Number.isFinite(q.manualEf)) {
    return { ef: Number(q.manualEf), source: "manual", provenance: null };
  }
  if (!efdbBase()) {
    return { ef: null, source: "none", provenance: null, note: "EFDB not configured" };
  }

  const words = (q.query ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
    .slice(0, 4);
  const queries = words.length ? words : [q.query.trim()].filter(Boolean);
  if (!queries.length) return { ef: null, source: "none", provenance: null, note: "query too short" };

  const seen = new Map<string, Record<string, unknown>>();
  for (const w of queries) {
    const res = await efdbGet(`/emission-factors?q=${encodeURIComponent(w)}&page_size=8`);
    if (res.status === 401) return { ef: null, source: "none", provenance: null, note: "EFDB auth failed" };
    for (const row of extractRows(res.body)) {
      const key = String(row.ef_id ?? row.id ?? `${row.activity_name}|${row.ef_value}`);
      if (!seen.has(key)) seen.set(key, row);
    }
    if (seen.size >= 12) break;
  }
  if (!seen.size) return { ef: null, source: "none", provenance: null, note: "no matching factor in EFDB" };

  const candidates = [...seen.values()]
    .map(toProvenance)
    .filter((c) => c.ef_value != null && c.ef_value > 0);
  if (!candidates.length) return { ef: null, source: "none", provenance: null, note: "no usable factor value" };

  const wantCountry = (q.country ?? "IN").toUpperCase();
  candidates.sort((a, b) => {
    const ac = a.country?.toUpperCase() === wantCountry ? 1 : 0;
    const bc = b.country?.toUpperCase() === wantCountry ? 1 : 0;
    if (ac !== bc) return bc - ac;
    return (b.dq_score ?? 0) - (a.dq_score ?? 0);
  });

  const best = candidates[0];
  return { ef: best.ef_value, source: "efdb", provenance: best };
}
