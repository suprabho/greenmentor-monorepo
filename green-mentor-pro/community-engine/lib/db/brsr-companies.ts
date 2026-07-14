/**
 * Company profile directory + detail, for /brsr/companies.
 *
 * Reads brsr_filings_public / brsr_company_activities_public (migration
 * 0017_brsr_company_profile.sql), populated by the platform scrape worker's
 * `profile` stage (platform/scripts/scrape-brsr.ts): contact block, the
 * turnover-weighted NIC-2008 sector/industry rollup (lib/brsr/nic-sector.ts
 * there), and the disclosure-coverage scorecard (lib/brsr/scorecard.ts there).
 * That stage is separate from `indicators`/`topics`, so a filing can be parsed
 * without being profiled yet — callers filter on the profiled columns.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type Pillar = "environment" | "social" | "governance";
export type BrsrCategory =
  | "emissions"
  | "energy"
  | "water"
  | "waste"
  | "safety"
  | "workforce"
  | "social"
  | "financial";

export type ScoreBreakdown = { matched: number; total: number; score: number };

export type Scorecard = {
  overall: ScoreBreakdown;
  byPillar: Record<Pillar, ScoreBreakdown>;
  byCategory: Record<BrsrCategory, ScoreBreakdown>;
  matchedKeys: string[];
  missingKeys: string[];
};

export type SectorShare = { sectionLetter: string; sectionTitle: string; superSector: string; weight: number };

// Matches fetchCompanyDirectory's `.select()` column list exactly — a
// narrower type than the full row so the compiler catches drift between the
// two if either changes.
type FilingListRow = {
  symbol: string;
  company_name: string;
  legal_name: string | null;
  fy_from: number;
  fy_to: number;
  primary_section: string | null;
  primary_section_title: string | null;
  super_sector: string | null;
  coverage_score: number | null;
  contact_email: string | null;
};

// Matches fetchCompanyProfile's `select("*")` — every profile column.
type FilingDetailRow = {
  symbol: string;
  company_name: string;
  legal_name: string | null;
  cin: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  fy_from: number;
  fy_to: number;
  submission_date: string | null;
  primary_section: string | null;
  primary_section_title: string | null;
  super_sector: string | null;
  primary_division: string | null;
  primary_division_title: string | null;
  sector_mapped_coverage: number | null;
  sector_shares: SectorShare[] | null;
  coverage_score: number | null;
  scorecard: Scorecard | null;
  indicator_count: number | null;
};

type ActivityRow = {
  nic_code: string;
  product_name: string | null;
  turnover: number;
  division_code: string | null;
  section_letter: string | null;
};

export type CompanyListItem = {
  symbol: string;
  name: string;
  fy: string;
  sectionLetter: string | null;
  sectionTitle: string | null;
  superSector: string | null;
  coverageScore: number | null;
  hasContact: boolean;
};

export type CompanyProfile = {
  symbol: string;
  legalName: string | null;
  companyName: string;
  cin: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  fy: string;
  submissionDate: string | null;
  sector: { letter: string; title: string; superSector: string } | null;
  industry: { code: string; title: string } | null;
  sectorMappedCoverage: number | null;
  sectorShares: SectorShare[];
  scorecard: Scorecard | null;
  indicatorCount: number | null;
  activities: {
    nicCode: string;
    name: string | null;
    turnover: number;
    divisionCode: string | null;
    sectionLetter: string | null;
  }[];
};

/** "2024-25" for April–March fiscal years; "CY 2024" for calendar-year filers. */
const fyLabel = (fyFrom: number, fyTo: number) =>
  fyFrom === fyTo ? `CY ${fyFrom}` : `${fyFrom}-${String(fyTo).padStart(4, "0").slice(-2)}`;

const shortName = (name: string) => name.replace(/ (LIMITED|Limited|LTD\.?|Ltd\.?)$/g, "").trim();

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

/** Latest profiled filing per symbol — a company can have several FYs profiled. */
function latestPerSymbol<T extends { symbol: string; fy_to: number }>(rows: T[]): Map<string, T> {
  const best = new Map<string, T>();
  for (const r of rows) {
    const prev = best.get(r.symbol);
    if (!prev || r.fy_to > prev.fy_to) best.set(r.symbol, r);
  }
  return best;
}

/** Directory of every profiled company, one row (latest FY) each. */
export async function fetchCompanyDirectory(supabase: SupabaseClient): Promise<CompanyListItem[]> {
  const rows = await fetchAllRows<FilingListRow>((from, to) =>
    supabase
      .from("brsr_filings_public")
      .select(
        "symbol, company_name, legal_name, fy_from, fy_to, primary_section, primary_section_title, super_sector, coverage_score, contact_email",
      )
      .not("coverage_score", "is", null)
      .range(from, to),
  );
  const latest = latestPerSymbol(rows);
  return [...latest.values()]
    .map((r) => ({
      symbol: r.symbol,
      name: shortName(r.legal_name || r.company_name),
      fy: fyLabel(r.fy_from, r.fy_to),
      sectionLetter: r.primary_section,
      sectionTitle: r.primary_section_title,
      superSector: r.super_sector,
      coverageScore: r.coverage_score,
      hasContact: !!r.contact_email,
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

/** Full profile for one company's latest profiled filing, plus its activity rows. */
export async function fetchCompanyProfile(supabase: SupabaseClient, symbol: string): Promise<CompanyProfile | null> {
  const { data: filings, error } = await supabase
    .from("brsr_filings_public")
    .select("*")
    .eq("symbol", symbol)
    .not("coverage_score", "is", null)
    .order("fy_to", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const filing = ((filings ?? []) as FilingDetailRow[])[0];
  if (!filing) return null;

  const { data: activities, error: actErr } = await supabase
    .from("brsr_company_activities_public")
    .select("nic_code, product_name, turnover, division_code, section_letter")
    .eq("symbol", symbol)
    .eq("fy_from", filing.fy_from)
    .eq("fy_to", filing.fy_to)
    .order("turnover", { ascending: false });
  if (actErr) throw new Error(actErr.message);

  return {
    symbol: filing.symbol,
    legalName: filing.legal_name,
    companyName: filing.company_name,
    cin: filing.cin,
    email: filing.contact_email,
    phone: filing.contact_phone,
    website: filing.website,
    fy: fyLabel(filing.fy_from, filing.fy_to),
    submissionDate: filing.submission_date,
    sector: filing.primary_section
      ? { letter: filing.primary_section, title: filing.primary_section_title ?? "", superSector: filing.super_sector ?? "" }
      : null,
    industry: filing.primary_division
      ? { code: filing.primary_division, title: filing.primary_division_title ?? "" }
      : null,
    sectorMappedCoverage: filing.sector_mapped_coverage,
    sectorShares: filing.sector_shares ?? [],
    scorecard: filing.scorecard,
    indicatorCount: filing.indicator_count,
    activities: ((activities ?? []) as ActivityRow[]).map((a) => ({
      nicCode: a.nic_code,
      name: a.product_name,
      turnover: a.turnover,
      divisionCode: a.division_code,
      sectionLetter: a.section_letter,
    })),
  };
}
