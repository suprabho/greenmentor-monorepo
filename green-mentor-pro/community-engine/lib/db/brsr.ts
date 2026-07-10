/**
 * Read-only aggregates for the /brsr admin dashboard.
 *
 * Reads the shared-project BRSR tables written by the platform scrape worker
 * (platform/scripts/scrape-brsr.ts, surfaced in the Pipeline tab as
 * "brsr-scrape"): operational state from brsr_filings (service-role — RLS has
 * no policies) and indicator slices from the public brsr_indicators_public
 * view. All aggregation happens here in JS, à la lib/pipeline/stats.ts, so the
 * page component just renders.
 *
 * As-filed BRSR numbers contain unit-error filings (kg filed as tonnes, etc.),
 * so the "largest emitters" cohort is cross-validated: a company is shown only
 * when its implied emission factor — (scope1+scope2) tCO2e per GJ of filed
 * energy — is physically plausible (≤ 1; coal power is ~0.1). The renewable
 * chart reuses that vetted cohort.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const INDICATOR_KEYS = [
  "scope1_emissions_total",
  "scope2_emissions_total",
  "energy_consumed_total",
  "energy_consumed_renewable",
  "water_withdrawal_total",
  "ltifr_workers",
  "fatalities_workers",
  "fatalities_employees",
] as const;

type FilingRow = {
  symbol: string;
  fy_from: number;
  fy_to: number;
  submission_date: string | null;
  xbrl_status: "pending" | "stored" | "failed" | "skipped";
  parse_status: "pending" | "parsed" | "failed";
  indicator_count: number | null;
};

type IndicatorRow = {
  symbol: string;
  company_name: string;
  fy_from: number;
  fy_to: number;
  indicator_key: string;
  value_numeric: number;
  unit: string | null;
  period_end: string | null;
};

export type EmitterDatum = {
  symbol: string;
  name: string;
  fy: string;
  scope1: number;
  scope2: number;
};

export type BrsrDashboard = {
  corpus: {
    filings: number;
    stored: number;
    skipped: number;
    failedDownloads: number;
    pendingDownloads: number;
    parsed: number;
    parseFailed: number;
    indicatorRows: number;
    companiesWithEmissions: number;
    latestSubmission: string | null;
  };
  byFy: { fy: string; total: number; parsed: number }[];
  emitters: EmitterDatum[];
  emittersExcluded: number;
  renewables: { symbol: string; name: string; fy: string; pct: number }[];
  ltifr: { bins: { label: string; count: number }[]; reported: number };
  water: { symbol: string; name: string; fy: string; kl: number }[];
  fatalities: { workers: number; employees: number; companies: number };
};

/** "2024-25" for April–March fiscal years; "CY 2024" for calendar-year filers. */
export const fyLabel = (fyFrom: number, fyTo: number) =>
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

/** Latest filing per company, keeping only that filing's current-FY context. */
function latestPerCompany(rows: IndicatorRow[]): Map<string, IndicatorRow> {
  const best = new Map<string, IndicatorRow>();
  for (const r of rows) {
    if (!r.period_end || !r.period_end.startsWith(String(r.fy_to))) continue;
    const prev = best.get(r.symbol);
    if (!prev || r.fy_to > prev.fy_to) best.set(r.symbol, r);
  }
  return best;
}

const shortName = (companyName: string) => companyName.replace(/ (LIMITED|Limited|LTD\.?|Ltd\.?)$/g, "").trim();

export async function fetchBrsrDashboard(supabase: SupabaseClient): Promise<BrsrDashboard> {
  const [filings, ...slices] = await Promise.all([
    fetchAllRows<FilingRow>((from, to) =>
      supabase
        .from("brsr_filings")
        .select("symbol, fy_from, fy_to, submission_date, xbrl_status, parse_status, indicator_count")
        .range(from, to),
    ),
    ...INDICATOR_KEYS.map((key) =>
      fetchAllRows<IndicatorRow>((from, to) =>
        supabase
          .from("brsr_indicators_public")
          .select("symbol, company_name, fy_from, fy_to, indicator_key, value_numeric, unit, period_end")
          .eq("indicator_key", key)
          .range(from, to),
      ),
    ),
  ]);
  const byKey = new Map(INDICATOR_KEYS.map((key, i) => [key, latestPerCompany(slices[i])]));

  // — corpus / per-FY state, straight off brsr_filings —
  const byFyMap = new Map<string, { fy: string; total: number; parsed: number; order: number }>();
  let stored = 0, skipped = 0, failedDownloads = 0, pendingDownloads = 0;
  let parsed = 0, parseFailed = 0, indicatorRows = 0;
  let latestSubmission: string | null = null;
  for (const f of filings) {
    if (f.xbrl_status === "stored") stored++;
    else if (f.xbrl_status === "skipped") skipped++;
    else if (f.xbrl_status === "failed") failedDownloads++;
    else pendingDownloads++;
    if (f.parse_status === "parsed") parsed++;
    else if (f.parse_status === "failed") parseFailed++;
    indicatorRows += f.indicator_count ?? 0;
    if (f.submission_date && (!latestSubmission || f.submission_date > latestSubmission)) {
      latestSubmission = f.submission_date;
    }
    const fy = fyLabel(f.fy_from, f.fy_to);
    const entry = byFyMap.get(fy) ?? { fy, total: 0, parsed: 0, order: f.fy_from * 100 + (f.fy_to % 100) };
    entry.total++;
    if (f.parse_status === "parsed") entry.parsed++;
    byFyMap.set(fy, entry);
  }
  const byFy = [...byFyMap.values()].sort((a, b) => a.order - b.order);

  // — largest emitters, cross-validated against filed energy —
  const scope1 = byKey.get("scope1_emissions_total")!;
  const scope2 = byKey.get("scope2_emissions_total")!;
  const energyTotal = byKey.get("energy_consumed_total")!;
  const emittersAll = [...scope1.values()]
    .map((r) => ({
      symbol: r.symbol,
      name: shortName(r.company_name),
      fy: fyLabel(r.fy_from, r.fy_to),
      scope1: r.value_numeric,
      scope2: scope2.get(r.symbol)?.value_numeric ?? 0,
      energyGJ: energyTotal.get(r.symbol)?.value_numeric ?? 0,
    }))
    .filter((d) => d.scope1 > 0)
    .sort((a, b) => b.scope1 + b.scope2 - (a.scope1 + a.scope2));
  const isPlausible = (d: (typeof emittersAll)[0]) =>
    d.energyGJ > 0 && (d.scope1 + d.scope2) / d.energyGJ <= 1 && d.scope1 < 1e9;
  const emitters = emittersAll.filter(isPlausible).slice(0, 12);
  const emittersExcluded = emittersAll.slice(0, 40).filter((d) => !isPlausible(d)).length;

  // — renewable share of that vetted cohort —
  const energyRenewable = byKey.get("energy_consumed_renewable")!;
  const renewables = emitters
    .map((e) => {
      const total = energyTotal.get(e.symbol)?.value_numeric ?? 0;
      const renewable = energyRenewable.get(e.symbol)?.value_numeric ?? 0;
      return { symbol: e.symbol, name: e.name, fy: e.fy, pct: total > 0 ? Math.min(100, (100 * renewable) / total) : 0 };
    })
    .sort((a, b) => b.pct - a.pct);

  // — worker LTIFR distribution —
  const ltifrValues = [...byKey.get("ltifr_workers")!.values()].map((r) => r.value_numeric);
  const bins = [
    { label: "0", test: (v: number) => v === 0 },
    { label: "0–0.5", test: (v: number) => v > 0 && v <= 0.5 },
    { label: "0.5–1", test: (v: number) => v > 0.5 && v <= 1 },
    { label: "1–2", test: (v: number) => v > 1 && v <= 2 },
    { label: "2–5", test: (v: number) => v > 2 && v <= 5 },
    { label: ">5", test: (v: number) => v > 5 },
  ].map((b) => ({ label: b.label, count: ltifrValues.filter(b.test).length }));

  // — largest water withdrawers (as filed) —
  const water = [...byKey.get("water_withdrawal_total")!.values()]
    .filter((r) => r.value_numeric > 0)
    .sort((a, b) => b.value_numeric - a.value_numeric)
    .slice(0, 10)
    .map((r) => ({ symbol: r.symbol, name: shortName(r.company_name), fy: fyLabel(r.fy_from, r.fy_to), kl: r.value_numeric }));

  // — fatalities headline —
  const fatalitiesWorkers = [...byKey.get("fatalities_workers")!.values()].reduce((s, r) => s + r.value_numeric, 0);
  const fatalitiesEmployees = [...byKey.get("fatalities_employees")!.values()].reduce((s, r) => s + r.value_numeric, 0);

  return {
    corpus: {
      filings: filings.length,
      stored,
      skipped,
      failedDownloads,
      pendingDownloads,
      parsed,
      parseFailed,
      indicatorRows,
      companiesWithEmissions: scope1.size,
      latestSubmission,
    },
    byFy,
    emitters,
    emittersExcluded,
    renewables,
    ltifr: { bins, reported: ltifrValues.length },
    water,
    fatalities: { workers: fatalitiesWorkers, employees: fatalitiesEmployees, companies: byKey.get("fatalities_workers")!.size },
  };
}
