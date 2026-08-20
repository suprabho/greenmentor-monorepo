import { createAdminClient } from "../admin";
import {
  businessSimilarity,
  marketSimilarity,
  overallScore,
  revenueSimilarity,
  type ActivityShare,
  type MarketsProfile,
} from "../peer/scoring";

/**
 * Read layer for the peer-research agent's grounding tools, over the BRSR corpus
 * the platform scrape worker maintains (brsr_filings / brsr_company_activities /
 * brsr_indicators — migrations 0011/0017). Service-role reads of the base tables:
 * these run server-side inside tool handlers only, and filter to cleanly profiled
 * filings just like the *_public views do.
 *
 * Query patterns (latest-FY-per-symbol, PostgREST 1000-row paging) follow
 * community-engine/lib/db/brsr-companies.ts.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface BrsrActivity extends ActivityShare {
  productName: string | null;
  sectionLetter: string | null;
}

export interface CompanyBrsrProfile {
  filingId: string;
  symbol: string;
  companyName: string;
  legalName: string | null;
  fy: string;
  fyFrom: number;
  fyTo: number;
  cin: string | null;
  website: string | null;
  sector: { sectionLetter: string; title: string; superSector: string } | null;
  industry: { divisionCode: string; title: string } | null;
  activities: BrsrActivity[];
  /** Absolute turnover from brsr_indicators (key "turnover"), latest period. */
  revenue: { value: number; unit: string | null; inrCr: number | null } | null;
  /** Markets-served columns (null until the markets migration + backfill land). */
  markets: MarketsProfile | null;
}

export interface PeerCandidate {
  profile: CompanyBrsrProfile;
  scores: {
    business: number | null;
    revenue: number | null;
    market: number | null; // null → agent falls back to web research for this pair
    overall: number | null;
  };
}

const fyLabel = (fyFrom: number, fyTo: number) =>
  fyFrom === fyTo ? `CY ${fyFrom}` : `${fyFrom}-${String(fyTo).padStart(4, "0").slice(-2)}`;

/** Page through a PostgREST query (server caps responses at 1000 rows). */
async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < page) return out;
  }
}

const toNum = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/**
 * Markets-served block from a brsr_filings row. The row comes from select("*")
 * so this degrades to null before the markets migration is applied — the agent
 * then covers the dimension via web research instead of failing.
 */
function marketsFromRow(row: Record<string, any>): MarketsProfile | null {
  const m: MarketsProfile = {
    plantsNational: toNum(row.plants_national),
    officesNational: toNum(row.offices_national),
    plantsInternational: toNum(row.plants_international),
    officesInternational: toNum(row.offices_international),
    statesServed: toNum(row.states_served),
    countriesServed: toNum(row.countries_served),
    exportsPctTurnover: toNum(row.exports_pct_turnover),
  };
  return Object.values(m).some((v) => v != null) ? m : null;
}

function mapActivities(rows: Record<string, any>[]): BrsrActivity[] {
  return rows.map((a) => ({
    nicCode: String(a.nic_code ?? ""),
    productName: a.product_name ?? null,
    turnover: toNum(a.turnover) ?? 0,
    divisionCode: a.division_code ?? null,
    sectionLetter: a.section_letter ?? null,
  }));
}

function mapProfile(
  filing: Record<string, any>,
  activities: Record<string, any>[],
  revenueRow: Record<string, any> | undefined,
): CompanyBrsrProfile {
  const revenue = toNum(revenueRow?.value_numeric);
  const unit = (revenueRow?.unit as string | null) ?? null;
  return {
    filingId: filing.id,
    symbol: filing.symbol,
    companyName: filing.company_name,
    legalName: filing.legal_name ?? null,
    fy: fyLabel(filing.fy_from, filing.fy_to),
    fyFrom: filing.fy_from,
    fyTo: filing.fy_to,
    cin: filing.cin ?? null,
    website: filing.website ?? null,
    sector: filing.primary_section
      ? {
          sectionLetter: filing.primary_section,
          title: filing.primary_section_title ?? "",
          superSector: filing.super_sector ?? "",
        }
      : null,
    industry: filing.primary_division
      ? { divisionCode: filing.primary_division, title: filing.primary_division_title ?? "" }
      : null,
    activities: mapActivities(activities),
    revenue:
      revenue != null
        ? {
            value: revenue,
            unit,
            // Turnover facts are filed in plain rupees (unitRef INR); surface ₹ crore
            // for readability. Left null for exotic units rather than guessed.
            inrCr: !unit || /inr/i.test(unit) ? Math.round((revenue / 1e7) * 100) / 100 : null,
          }
        : null,
    markets: marketsFromRow(filing),
  };
}

/** Latest turnover fact per filing (a filing carries current + previous FY contexts). */
async function fetchRevenueByFiling(admin: any, filingIds: string[]): Promise<Map<string, Record<string, any>>> {
  if (!filingIds.length) return new Map();
  const rows = await fetchAllRows<Record<string, any>>((from, to) =>
    admin
      .from("brsr_indicators")
      .select("filing_id, value_numeric, unit, period_end, context_ref")
      .eq("indicator_key", "turnover")
      .in("filing_id", filingIds)
      .range(from, to),
  );
  const best = new Map<string, Record<string, any>>();
  for (const r of rows) {
    const prev = best.get(r.filing_id);
    if (!prev || String(r.period_end ?? "") > String(prev.period_end ?? "")) best.set(r.filing_id, r);
  }
  return best;
}

/**
 * Resolve a company to its latest cleanly-profiled BRSR filing, by NSE symbol
 * (exact, case-insensitive) or legal/company name (substring).
 */
export async function resolveCompany(query: { symbol?: string; name?: string }): Promise<CompanyBrsrProfile | null> {
  const admin = createAdminClient();

  let filings: Record<string, any>[] | null = null;
  if (query.symbol?.trim()) {
    const { data, error } = await admin
      .from("brsr_filings")
      .select("*")
      .ilike("symbol", query.symbol.trim())
      .eq("profile_status", "extracted")
      .order("fy_to", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    filings = data;
  }
  if (!filings?.length && query.name?.trim()) {
    // PostgREST or() treats , ( ) as syntax — strip them from the needle.
    const needle = query.name.trim().replace(/[,()]/g, " ").replace(/\s+/g, " ");
    const { data, error } = await admin
      .from("brsr_filings")
      .select("*")
      .or(`legal_name.ilike.%${needle}%,company_name.ilike.%${needle}%`)
      .eq("profile_status", "extracted")
      .order("fy_to", { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);
    // Several FYs / near-matches can come back; keep the latest filing of the best match.
    filings = data?.length ? [data[0]] : null;
  }
  const filing = filings?.[0];
  if (!filing) return null;

  const { data: activities, error: actErr } = await admin
    .from("brsr_company_activities")
    .select("nic_code, product_name, turnover, division_code, section_letter")
    .eq("filing_id", filing.id)
    .order("turnover", { ascending: false });
  if (actErr) throw new Error(actErr.message);

  const revenue = await fetchRevenueByFiling(admin, [filing.id]);
  return mapProfile(filing, activities ?? [], revenue.get(filing.id));
}

/**
 * Find peer candidates sharing NIC divisions with the subject, scored on all
 * three dimensions. Candidates come from the latest profiled filing per symbol.
 */
export async function findPeerCandidates(
  subject: CompanyBrsrProfile,
  opts: { limit?: number } = {},
): Promise<PeerCandidate[]> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 50);
  const admin = createAdminClient();

  const divisions = [...new Set(subject.activities.map((a) => a.divisionCode).filter(Boolean))] as string[];
  const sections = [...new Set(subject.activities.map((a) => a.sectionLetter).filter(Boolean))] as string[];
  if (!divisions.length && !sections.length && !subject.sector) return [];

  // Matching activity rows with their filing identity embedded; division match
  // preferred, section-letter fallback for subjects whose codes didn't resolve
  // to a division.
  const baseSelect = "filing_id, brsr_filings!inner(id, symbol, fy_from, fy_to, profile_status)";
  const matchRows = await fetchAllRows<Record<string, any>>((from, to) => {
    let q = admin.from("brsr_company_activities").select(baseSelect).range(from, to);
    q = divisions.length
      ? q.in("division_code", divisions)
      : q.in("section_letter", sections.length ? sections : [subject.sector!.sectionLetter]);
    return q.eq("brsr_filings.profile_status", "extracted").neq("brsr_filings.symbol", subject.symbol);
  });

  // Latest FY per candidate symbol.
  const latestBySymbol = new Map<string, { filingId: string; fyTo: number }>();
  for (const r of matchRows) {
    const f = r.brsr_filings;
    if (!f) continue;
    const prev = latestBySymbol.get(f.symbol);
    if (!prev || f.fy_to > prev.fyTo) latestBySymbol.set(f.symbol, { filingId: f.id, fyTo: f.fy_to });
  }
  // Generous pre-cap before the detail fetches; final ranking trims to `limit`.
  const filingIds = [...latestBySymbol.values()].map((v) => v.filingId).slice(0, 200);
  if (!filingIds.length) return [];

  const [filings, allActivities, revenueByFiling] = await Promise.all([
    fetchAllRows<Record<string, any>>((from, to) =>
      admin.from("brsr_filings").select("*").in("id", filingIds).range(from, to),
    ),
    fetchAllRows<Record<string, any>>((from, to) =>
      admin
        .from("brsr_company_activities")
        .select("filing_id, nic_code, product_name, turnover, division_code, section_letter")
        .in("filing_id", filingIds)
        .range(from, to),
    ),
    fetchRevenueByFiling(admin, filingIds),
  ]);

  const activitiesByFiling = new Map<string, Record<string, any>[]>();
  for (const a of allActivities) {
    const list = activitiesByFiling.get(a.filing_id) ?? [];
    list.push(a);
    activitiesByFiling.set(a.filing_id, list);
  }

  const candidates: PeerCandidate[] = filings.map((filing) => {
    const profile = mapProfile(filing, activitiesByFiling.get(filing.id) ?? [], revenueByFiling.get(filing.id));
    const scores = {
      business: businessSimilarity(subject.activities, profile.activities),
      revenue: revenueSimilarity(subject.revenue?.value ?? null, profile.revenue?.value ?? null),
      market: marketSimilarity(subject.markets, profile.markets),
    };
    return { profile, scores: { ...scores, overall: overallScore(scores) } };
  });

  return candidates
    .filter((c) => c.scores.overall != null)
    .sort((a, b) => (b.scores.overall ?? 0) - (a.scores.overall ?? 0))
    .slice(0, limit);
}

/** One row in the Studio's company picker — the BRSR corpus directory. */
export interface BrsrCompanyListItem {
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  revenueInrCr: number | null;
  fy: string;
  /** Filing carries Section A markets data (migration 0032 + backfill) — the
   *  market similarity dimension is only filing-grounded when this is true. */
  hasMarketsData: boolean;
}

/**
 * Directory of cleanly-profiled companies (latest FY each) for the Agent Studio
 * picker — the same corpus behind the BRSR intelligence reports. `search`
 * matches symbol or legal/company name.
 */
export async function listBrsrCompanies(
  opts: { search?: string; limit?: number } = {},
): Promise<BrsrCompanyListItem[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const admin = createAdminClient();

  const rows = await fetchAllRows<Record<string, any>>((from, to) => {
    let q = admin
      .from("brsr_filings")
      .select(
        "id, symbol, company_name, legal_name, fy_from, fy_to, primary_section, primary_section_title," +
          " primary_division, primary_division_title, plants_national, offices_national, plants_international," +
          " offices_international, states_served, countries_served, exports_pct_turnover",
      )
      .eq("profile_status", "extracted");
    const needle = opts.search?.trim().replace(/[,()]/g, " ").replace(/\s+/g, " ");
    if (needle) {
      q = q.or(`symbol.ilike.%${needle}%,legal_name.ilike.%${needle}%,company_name.ilike.%${needle}%`);
    }
    return q.order("symbol", { ascending: true }).range(from, to);
  });

  const latest = new Map<string, Record<string, any>>();
  for (const r of rows) {
    const prev = latest.get(r.symbol);
    if (!prev || r.fy_to > prev.fy_to) latest.set(r.symbol, r);
  }
  const picked = [...latest.values()].slice(0, limit);
  const revenue = await fetchRevenueByFiling(admin, picked.map((f) => f.id));

  return picked.map((f) => {
    const rev = toNum(revenue.get(f.id)?.value_numeric);
    const unit = (revenue.get(f.id)?.unit as string | null) ?? null;
    return {
      symbol: f.symbol,
      name: f.legal_name || f.company_name,
      sector: f.primary_section ? `${f.primary_section} — ${f.primary_section_title ?? ""}`.trim() : null,
      industry: f.primary_division ? `${f.primary_division} — ${f.primary_division_title ?? ""}`.trim() : null,
      revenueInrCr: rev != null && (!unit || /inr/i.test(unit)) ? Math.round((rev / 1e7) * 100) / 100 : null,
      fy: fyLabel(f.fy_from, f.fy_to),
      hasMarketsData: marketsFromRow(f) != null,
    };
  });
}
