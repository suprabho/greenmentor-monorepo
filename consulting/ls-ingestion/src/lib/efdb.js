// ─────────────────────────────────────────────────────────────────────────────
// REAL EFDB INTEGRATION
// Uses authenticated endpoint (GET /emission-factors) with JWT from EFDB login,
// then falls back to the public endpoint. No hardcoded factors — if EFDB has no
// matching record (or is unreachable), the extraction fails loudly so the
// underlying data gap is visible instead of silently substituted.
// Field names match EmissionFactorOut schema exactly.
// ─────────────────────────────────────────────────────────────────────────────
export const EFDB_PUBLIC = "/efdb/emission-factors/public";
export const EFDB_AUTH   = "/efdb/emission-factors";
export const EFDB_LOGIN  = "/efdb/auth/login";

// Maps bill activity → EFDB query params (matches canonical_activity_name ilike search).
// Mirrors the canonical names seeded by efdb/backend/scripts/seed_india_factors.py.
export const EFDB_QUERIES = {
  electricity: { q:"electricity purchased",        scope:"Scope 2", country:"IN" },
  diesel:      { q:"diesel combustion",            scope:"Scope 1", country:"IN" },
  petrol:      { q:"petrol combustion",            scope:"Scope 1", country:"IN" },
  cng:         { q:"CNG combustion",               scope:"Scope 1", country:"IN" },
  lpg:         { q:"LPG combustion",               scope:"Scope 1", country:"IN" },
  hsd:         { q:"HSD fuel oil combustion",      scope:"Scope 1", country:"IN" },
  coal:        { q:"coal combustion",              scope:"Scope 1", country:"IN" },
};

export const factorCache = {};

// Try authenticated EFDB → public EFDB → throw
export async function lookupFactor(billType, fuelType, efdbToken) {
  const key = billType==="electricity" ? "electricity" : (fuelType||"diesel");
  if (factorCache[key]) return factorCache[key];

  const qp = EFDB_QUERIES[key];
  if (!qp) throw new Error(`No EFDB query mapping for activity "${key}"`);

  // Try authenticated endpoint first (has all records including India-specific)
  if (efdbToken) {
    try {
      const url = `${EFDB_AUTH}?q=${encodeURIComponent(qp.q)}&country=${qp.country}&scope=${encodeURIComponent(qp.scope)}&sort_by=confidence_score&sort_dir=desc&page_size=5`;
      const r = await fetch(url, { headers:{ "Authorization":`Bearer ${efdbToken}` }, signal:AbortSignal.timeout(5000) });
      if (r.ok) {
        const d = await r.json();
        if (d.items?.length > 0) {
          const f = { ...d.items[0], _source:"efdb_authenticated" };
          factorCache[key] = f;
          return f;
        }
      }
    } catch(_) {}
  }

  // Try public endpoint (no auth)
  try {
    const url = `${EFDB_PUBLIC}?q=${encodeURIComponent(qp.q)}&country=${qp.country}&scope=${encodeURIComponent(qp.scope)}&page_size=5`;
    const r = await fetch(url, { signal:AbortSignal.timeout(5000) });
    if (r.ok) {
      const d = await r.json();
      if (d.items?.length > 0) {
        const f = { ...d.items[0], _source:"efdb_public" };
        factorCache[key] = f;
        return f;
      }
    }
  } catch(_) {}

  throw new Error(`EFDB has no "${key}" factor for ${qp.country}/${qp.scope}. Seed it with scripts.seed_india_factors or upload via the EFDB ingestion flow.`);
}
