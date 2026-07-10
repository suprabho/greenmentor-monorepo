/**
 * BRSR dashboard view — pure server-rendered presentation for /brsr.
 *
 * House chart idioms (see pipeline page's IngestByDay): dependency-free
 * flex/inline-style marks, thin bars with 4px rounded data-ends, CSS-only
 * hover/focus tooltips in the teal house bubble, values in text tokens, and a
 * <details> table view under every chart so nothing is gated behind hover.
 * Series hues are categorical slots 1–2 of the validated dataviz palette
 * (same set as stories/modules/chart/Component.tsx — local there, so
 * re-declared here). This app is light-only.
 */
import { Card, Stat } from "@/components/ui";
import type { BrsrDashboard } from "@/lib/db/brsr";

const SERIES_1 = "#2a78d6"; // categorical slot 1 (blue)
const SERIES_2 = "#1baf7a"; // categorical slot 2 (aqua)
const TRACK = "#cde2fb"; // lighter step of the slot-1 ramp — meter track

const full = (n: number) => Math.round(n).toLocaleString("en-IN");
const compact = (n: number) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n * 100) / 100);
};

function SectionHeading({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">{children}</h2>
      {note && <span className="text-[12px] text-gray-500">{note}</span>}
    </div>
  );
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-teal-900 px-2 py-0.5 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
    >
      {children}
    </span>
  );
}

function TableView({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-[12px] text-gray-500">Table view</summary>
      <table className="mt-2 w-full text-[12px]">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`border-b border-gray-100 pb-1 pr-3 font-semibold text-gray-500 ${i === 0 ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td key={ci} className={`border-b border-gray-100 py-1 pr-3 ${ci === 0 ? "text-left text-ink" : "text-right tabular-nums text-gray-600"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Left label · baseline-anchored track · right value — one bar row. */
function BarRow({
  name,
  fy,
  value,
  tooltip,
  ariaLabel,
  children,
}: {
  name: string;
  fy: string;
  value: string;
  tooltip: React.ReactNode;
  ariaLabel: string;
  children: React.ReactNode; // the track contents
}) {
  return (
    <div className="group relative grid grid-cols-[170px_1fr_64px] items-center gap-3 py-[3px]" tabIndex={0} aria-label={ariaLabel}>
      <Tooltip>{tooltip}</Tooltip>
      <span className="flex min-w-0 items-baseline gap-1.5 text-[12.5px] text-ink">
        <span className="truncate">{name}</span>
        <span className="shrink-0 text-[11px] text-gray-400">{fy}</span>
      </span>
      <span className="flex h-4 items-center border-l border-[#c3c2b7]">{children}</span>
      <span className="text-right text-[12px] tabular-nums text-gray-600">{value}</span>
    </div>
  );
}

export function BrsrDashboardView({ data }: { data: BrsrDashboard }) {
  const { corpus, byFy, emitters, emittersExcluded, renewables, ltifr, water, fatalities } = data;
  const maxEmit = Math.max(1, ...emitters.map((d) => d.scope1 + d.scope2));
  const maxWater = Math.max(1, ...water.map((d) => d.kl));
  const maxLtifr = Math.max(1, ...ltifr.bins.map((b) => b.count));

  return (
    <div>
      {/* corpus state */}
      <SectionHeading note={corpus.latestSubmission ? `latest filing ${corpus.latestSubmission}` : undefined}>
        Corpus
      </SectionHeading>
      <Card className="mb-6 grid grid-cols-2 gap-y-5 p-5 sm:grid-cols-4">
        <Stat label="Filings indexed" value={full(corpus.filings)} sub="FY21-22 → today" />
        <Stat
          label="Parsed"
          value={full(corpus.parsed)}
          sub={`${corpus.filings > 0 ? Math.round((100 * corpus.parsed) / corpus.filings) : 0}% of corpus`}
          tone={corpus.parseFailed > 0 ? "warn" : "ok"}
        />
        <Stat label="Indicator rows" value={compact(corpus.indicatorRows)} sub="56 BRSR Core keys" />
        <Stat label="Companies w/ emissions" value={full(corpus.companiesWithEmissions)} sub="Scope 1, latest FY" />
        <Stat label="XBRL archived" value={full(corpus.stored)} sub="brsr-filings bucket" />
        <Stat
          label="Gone at NSE"
          value={full(corpus.skipped)}
          sub="dead index links"
          tone={corpus.skipped > 0 ? "warn" : "default"}
        />
        <Stat
          label="Download retries"
          value={full(corpus.failedDownloads)}
          sub="next worker run"
          tone={corpus.failedDownloads > 0 ? "warn" : "default"}
        />
        <Stat label="Awaiting download" value={full(corpus.pendingDownloads)} sub="fresh filings" />
      </Card>

      {/* per-FY coverage */}
      <SectionHeading>Coverage by financial year</SectionHeading>
      <Card className="mb-6 p-5">
        {byFy.map((f) => (
          <div key={f.fy} className="group relative grid grid-cols-[80px_1fr_110px] items-center gap-3 py-1.5" tabIndex={0} aria-label={`FY ${f.fy}: ${f.parsed} of ${f.total} filings parsed`}>
            <Tooltip>
              FY {f.fy} · {full(f.parsed)} parsed of {full(f.total)}
            </Tooltip>
            <span className="text-[12.5px] text-ink">{f.fy}</span>
            <span className="h-1.5 overflow-hidden rounded-pill bg-gray-100">
              <span className="block h-full rounded-pill bg-green-500" style={{ width: `${f.total > 0 ? (100 * f.parsed) / f.total : 0}%` }} />
            </span>
            <span className="text-right text-[12px] tabular-nums text-gray-600">
              {full(f.parsed)} / {full(f.total)}
            </span>
          </div>
        ))}
      </Card>

      {/* emitters */}
      <SectionHeading note="latest filed FY per company">Largest emitters — Scope 1 + 2 (tCO₂e, as filed)</SectionHeading>
      <Card className="mb-6 p-5">
        <div className="mb-3 flex gap-4 text-[12px] text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: SERIES_1 }} /> Scope 1
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: SERIES_2 }} /> Scope 2
          </span>
        </div>
        {emitters.map((d) => {
          const total = d.scope1 + d.scope2;
          const w1 = (100 * d.scope1) / maxEmit;
          const w2 = (100 * d.scope2) / maxEmit;
          const showS2 = w2 >= 0.4;
          return (
            <BarRow
              key={d.symbol}
              name={d.name}
              fy={d.fy}
              value={compact(total)}
              ariaLabel={`${d.name} FY${d.fy}: scope 1 ${full(d.scope1)}, scope 2 ${full(d.scope2)} tonnes CO2e`}
              tooltip={
                <>
                  {d.name} · S1 {compact(d.scope1)} · S2 {compact(d.scope2)} tCO₂e
                </>
              }
            >
              <span className="h-4" style={{ width: `${w1}%`, background: SERIES_1, borderRadius: showS2 ? 0 : "0 4px 4px 0" }} />
              {showS2 && <span className="ml-[2px] h-4 rounded-r-[4px]" style={{ width: `${w2}%`, background: SERIES_2 }} />}
            </BarRow>
          );
        })}
        <p className="mt-3 text-[12px] text-gray-500">
          Shown only where filed emissions and energy are mutually consistent (implied factor ≤ 1 tCO₂e/GJ) —{" "}
          {emittersExcluded} of the top 40 as-filed values excluded as unit-suspect or lacking energy data.
        </p>
        <TableView
          head={["Company", "FY", "Scope 1 (tCO₂e)", "Scope 2 (tCO₂e)"]}
          rows={emitters.map((d) => [d.name, d.fy, full(d.scope1), full(d.scope2)])}
        />
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* renewable share */}
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold text-ink">Renewable share of energy</h3>
          <p className="mb-3 text-[12px] text-gray-500">% of filed energy consumption, same emitter cohort</p>
          {renewables.map((d) => (
            <BarRow
              key={d.symbol}
              name={d.name}
              fy={d.fy}
              value={`${d.pct.toFixed(1)}%`}
              ariaLabel={`${d.name}: ${d.pct.toFixed(1)} percent renewable`}
              tooltip={
                <>
                  {d.name} · {d.pct.toFixed(1)}% renewable
                </>
              }
            >
              <span className="h-4 w-full rounded-r-[4px]" style={{ background: TRACK }}>
                <span className="block h-4 rounded-r-[4px]" style={{ width: `${Math.max(d.pct, 0.5)}%`, background: SERIES_1 }} />
              </span>
            </BarRow>
          ))}
          <TableView head={["Company", "FY", "Renewable %"]} rows={renewables.map((d) => [d.name, d.fy, `${d.pct.toFixed(1)}%`])} />
        </Card>

        {/* LTIFR distribution */}
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold text-ink">Worker LTIFR distribution</h3>
          <p className="mb-3 text-[12px] text-gray-500">
            Lost-time injuries per 1M person-hours — {full(ltifr.reported)} companies, latest FY
          </p>
          <div className="flex items-end gap-6 border-b border-[#c3c2b7] px-2 pt-8" style={{ height: 170 }}>
            {ltifr.bins.map((b) => (
              <div key={b.label} className="group relative flex flex-col items-center justify-end" tabIndex={0} aria-label={`LTIFR ${b.label}: ${b.count} companies`}>
                <Tooltip>
                  LTIFR {b.label} · {full(b.count)} companies
                </Tooltip>
                <span className="mb-1 text-[11px] tabular-nums text-gray-600">{full(b.count)}</span>
                <span className="w-6 rounded-t-[4px]" style={{ height: Math.max(3, Math.round((130 * b.count) / maxLtifr)), background: SERIES_1 }} />
              </div>
            ))}
          </div>
          <div className="flex gap-6 px-2 pt-1.5">
            {ltifr.bins.map((b) => (
              <span key={b.label} className="w-6 text-center text-[11px] text-gray-400">
                {b.label}
              </span>
            ))}
          </div>
          <TableView head={["Band", "Companies"]} rows={ltifr.bins.map((b) => [b.label, full(b.count)])} />
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* water */}
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold text-ink">Largest water withdrawers</h3>
          <p className="mb-3 text-[12px] text-gray-500">Kilolitres, as filed, latest FY per company</p>
          {water.map((d) => (
            <BarRow
              key={d.symbol}
              name={d.name}
              fy={d.fy}
              value={compact(d.kl)}
              ariaLabel={`${d.name}: ${full(d.kl)} kilolitres`}
              tooltip={
                <>
                  {d.name} · {full(d.kl)} KL
                </>
              }
            >
              <span className="h-4 rounded-r-[4px]" style={{ width: `${(100 * d.kl) / maxWater}%`, background: SERIES_1 }} />
            </BarRow>
          ))}
          <TableView head={["Company", "FY", "Withdrawal (KL)"]} rows={water.map((d) => [d.name, d.fy, full(d.kl)])} />
        </Card>

        {/* safety headlines */}
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold text-ink">Safety headlines</h3>
          <p className="mb-4 text-[12px] text-gray-500">Fatalities summed across each company&apos;s latest parsed filing</p>
          <div className="grid grid-cols-2 gap-y-5">
            <Stat label="Worker fatalities" value={full(fatalities.workers)} sub={`across ${full(fatalities.companies)} companies`} tone={fatalities.workers > 0 ? "warn" : "ok"} />
            <Stat label="Employee fatalities" value={full(fatalities.employees)} sub="same cohort" tone={fatalities.employees > 0 ? "warn" : "ok"} />
          </div>
        </Card>
      </div>

      <p className="text-[12px] text-gray-500">
        All values as filed by companies in NSE BRSR XBRL — filer unit errors exist; nothing here is restated. Scraped
        daily by the <span className="font-medium text-gray-700">brsr-scrape</span> worker (Pipeline tab).
      </p>
    </div>
  );
}
