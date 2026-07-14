// Content-library lookups (Doc 4) — the Supabase-native replacement for the
// Airtable/Make graceful-degradation logic. Best Practices degrade over 5 tiers;
// Peer Benefits degrade over 3 tiers per category. The "other" cluster always
// exists, so a fully-populated PDF is guaranteed. Reads go through the service-
// role admin client (passed in) since there is no authenticated user.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { FrameworkResult, ReadinessResult, SubAreaKey } from "./types";

export interface BestPracticeBullet {
  text: string;
  citation: string;
  subarea?: SubAreaKey | null;
  frameworks?: string[];
}

export interface PeerBenefit {
  category: "investor_banking" | "customer_market" | "compliance_risk";
  body: string;
  citation: string;
}

export interface ContentBundle {
  bestPractices: BestPracticeBullet[];
  bestPracticesTier: number; // which of the 5 attempts matched (for analytics)
  peerBenefits: PeerBenefit[]; // 0–3 (categories with no content are omitted)
}

const PEER_CATEGORIES = ["investor_banking", "customer_market", "compliance_risk"] as const;

/** Apply an "IS NULL" filter when the value is null, else equality. */
function eqOrNull(query: any, column: string, value: string | null) {
  return value === null ? query.is(column, null) : query.eq(column, value);
}

async function fetchBestPracticeCell(
  supabase: SupabaseClient,
  sector: string,
  band: string | null,
  turnover: string | null,
  subarea: string | null,
): Promise<BestPracticeBullet[] | null> {
  let q = supabase.from("esg_best_practices").select("bullets").eq("sector", sector).eq("status", "published");
  q = eqOrNull(q, "band", band);
  q = eqOrNull(q, "turnover", turnover);
  q = eqOrNull(q, "subarea", subarea);
  const { data } = await q.limit(1).maybeSingle();
  const bullets = (data?.bullets as BestPracticeBullet[] | undefined) ?? null;
  return bullets && bullets.length > 0 ? bullets : null;
}

/**
 * Rank and trim to ≤5 bullets (Doc 4): weakest-sub-area bullets first, then
 * bullets touching a Definite/Likely framework, then the rest.
 */
function rankBullets(
  bullets: BestPracticeBullet[],
  weakest: SubAreaKey,
  frameworks: FrameworkResult[],
): BestPracticeBullet[] {
  const applicableKeys = new Set<string>(
    frameworks.filter((f) => f.label === "Definite" || f.label === "Likely").map((f) => f.key),
  );
  const rank = (b: BestPracticeBullet) => {
    if (b.subarea === weakest) return 0;
    if (b.frameworks?.some((k) => applicableKeys.has(k))) return 1;
    return 2;
  };
  return [...bullets].sort((a, b) => rank(a) - rank(b)).slice(0, 5);
}

async function lookupBestPractices(
  supabase: SupabaseClient,
  sector: string,
  band: string,
  turnover: string,
  weakest: SubAreaKey,
  frameworks: FrameworkResult[],
): Promise<{ bullets: BestPracticeBullet[]; tier: number }> {
  const attempts: Array<[string, string | null, string | null, string | null]> = [
    [sector, band, turnover, weakest], // 1 — exact
    [sector, band, turnover, null], // 2 — drop sub-area
    [sector, band, null, null], // 3 — drop turnover
    [sector, null, null, null], // 4 — drop band
    ["other", null, null, null], // 5 — Other cluster (always exists)
  ];
  for (let i = 0; i < attempts.length; i++) {
    const [s, b, t, sub] = attempts[i];
    const found = await fetchBestPracticeCell(supabase, s, b, t, sub);
    if (found) return { bullets: rankBullets(found, weakest, frameworks), tier: i + 1 };
  }
  return { bullets: [], tier: 0 };
}

async function lookupPeerBenefit(
  supabase: SupabaseClient,
  sector: string,
  turnover: string,
  category: string,
): Promise<PeerBenefit | null> {
  const attempts: Array<[string, string | null]> = [
    [sector, turnover], // 1 — exact
    [sector, null], // 2 — drop turnover
    ["other", null], // 3 — Other cluster
  ];
  for (const [s, t] of attempts) {
    let q = supabase
      .from("esg_peer_benefits")
      .select("category, body, citation")
      .eq("sector", s)
      .eq("category", category)
      .eq("status", "published");
    q = eqOrNull(q, "turnover", t);
    const { data } = await q.limit(1).maybeSingle();
    if (data) return data as PeerBenefit;
  }
  return null;
}

/** Fetch all Page-2 content for a respondent with full graceful degradation. */
export async function fetchContent(
  supabase: SupabaseClient,
  params: { sector: string; turnover: string; readiness: ReadinessResult; frameworks: FrameworkResult[] },
): Promise<ContentBundle> {
  const { sector, turnover, readiness, frameworks } = params;

  const bp = await lookupBestPractices(
    supabase,
    sector,
    readiness.band,
    turnover,
    readiness.weakestSubarea,
    frameworks,
  );

  const peer: PeerBenefit[] = [];
  for (const category of PEER_CATEGORIES) {
    const p = await lookupPeerBenefit(supabase, sector, turnover, category);
    if (p) peer.push(p);
  }

  return { bestPractices: bp.bullets, bestPracticesTier: bp.tier, peerBenefits: peer };
}
