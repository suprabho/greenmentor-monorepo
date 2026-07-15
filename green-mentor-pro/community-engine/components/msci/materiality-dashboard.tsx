/**
 * MSCI materiality map — overview dashboard (server-rendered) for /materiality.
 * Follows the house chart idiom (see components/nic/nic-dashboard.tsx): dependency
 * -free flex/inline-style marks, thin bars with rounded data-ends, CSS-only teal
 * -bubble tooltips, values in text tokens, and a <details> table under every
 * chart. Light-only.
 *
 * The headline chart is a 100%-stacked E/S/G split per GICS sector — the average
 * Key Issue weight rolled up to pillar level. Governance is a flat ~33% pillar
 * weight everywhere; the Environmental vs Social tilt is what varies by sector.
 * Pillar hues are validated categorical slots (see ./pillars); green & amber are
 * below 3:1 on white, so bars are direct-labelled and a table view is provided.
 */
import { Card, Stat } from "@/components/ui";
import {
  MSCI_SECTORS,
  MSCI_TOTALS,
  MSCI_AS_OF,
  WEIGHTED_ISSUE_ORDER,
  MSCI_KEY_ISSUE_BY_ID,
  type MsciIndustry,
  type MsciPillar,
} from "@/lib/msci/materiality-map";
import { PILLAR_META, PILLAR_ORDER, fmtWeight } from "./pillars";

// Which pillar each weighted column belongs to — fixed for the whole dataset.
const COL_PILLAR: MsciPillar[] = WEIGHTED_ISSUE_ORDER.map(
  (id) => MSCI_KEY_ISSUE_BY_ID.get(id)!.pillar,
);

/** Roll an industry's 28 column weights up to E/S/G pillar totals. */
function pillarSplit(ind: MsciIndustry): Record<MsciPillar, number> {
  const acc: Record<MsciPillar, number> = { environmental: 0, social: 0, governance: 0 };
  ind.weights.forEach((w, i) => {
    acc[COL_PILLAR[i]] += w;
  });
  return acc;
}

function SectionHeading({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">{children}</h2>
      {note && <span className="text-right text-[12px] text-gray-500">{note}</span>}
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
              <th
                key={h}
                className={`border-b border-gray-100 pb-1 pr-3 font-semibold text-gray-500 ${i === 0 ? "text-left" : "text-right"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td
                  key={ci}
                  className={`border-b border-gray-100 py-1 pr-3 ${ci === 0 ? "text-left text-ink" : "text-right tabular-nums text-gray-600"}`}
                >
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

/** The E/S/G colour key. */
function PillarLegend() {
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
      {PILLAR_ORDER.map((p) => (
        <span key={p} className="flex items-center gap-2 text-[12px]">
          <span className="size-3 shrink-0 rounded-[3px]" style={{ background: PILLAR_META[p].hue }} />
          <span className="font-semibold text-ink">{PILLAR_META[p].label}</span>
        </span>
      ))}
    </div>
  );
}

/** One sector's 100%-stacked E/S/G bar. */
function SectorSplitRow({ sector }: { sector: MsciIndustry }) {
  const split = pillarSplit(sector);
  const total = PILLAR_ORDER.reduce((s, p) => s + split[p], 0) || 1;
  return (
    <div className="mb-3 last:mb-0 grid grid-cols-[minmax(0,180px)_1fr] items-center gap-3">
      <span className="truncate text-[12.5px] text-ink" title={sector.name}>
        {sector.name}
      </span>
      <div className="flex h-5 w-full gap-[2px] overflow-hidden rounded-[5px]">
        {PILLAR_ORDER.map((p) => {
          const pct = (100 * split[p]) / total;
          if (pct <= 0) return null;
          const m = PILLAR_META[p];
          return (
            <span
              key={p}
              className="group relative grid h-5 place-items-center"
              style={{ width: `${pct}%`, background: m.hue }}
              tabIndex={0}
              aria-label={`${m.label}: ${fmtWeight(split[p])}% of ${sector.name}`}
            >
              <Tooltip>
                {m.label} · {fmtWeight(split[p])}%
              </Tooltip>
              {pct >= 10 && (
                <span className="text-[10.5px] font-semibold tabular-nums text-white">{Math.round(pct)}</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function MaterialityDashboard() {
  // Sort sectors by Social share so the E↔S tilt reads top-to-bottom.
  const sectors = [...MSCI_SECTORS].sort((a, b) => pillarSplit(b).social - pillarSplit(a).social);

  return (
    <div>
      <SectionHeading note={`average Key Issue weights · as of ${MSCI_AS_OF}`}>
        The framework at a glance
      </SectionHeading>
      <Card className="mb-6 grid grid-cols-2 gap-y-5 p-5 sm:grid-cols-5">
        <Stat label="Pillars" value={String(MSCI_TOTALS.pillars)} sub="E · S · G" />
        <Stat label="Themes" value={String(MSCI_TOTALS.themes)} sub="issue groups" />
        <Stat
          label="Key Issues"
          value={String(MSCI_TOTALS.weightedKeyIssues)}
          sub={`weighted · ${MSCI_TOTALS.keyIssues} rows`}
        />
        <Stat label="Sectors" value={String(MSCI_TOTALS.sectors)} sub="GICS · 2-digit" />
        <Stat label="Sub-industries" value={String(MSCI_TOTALS.subIndustries)} sub="GICS · 8-digit" />
      </Card>

      <SectionHeading note="100%-stacked · sorted by Social share">How materiality splits by sector</SectionHeading>
      <Card className="mb-6 p-5">
        <p className="mb-4 text-[12px] text-gray-500">
          Each sector&apos;s average Key Issue weights rolled up to the three pillars. Governance is a near-constant ~33%
          pillar weight; the Environmental vs Social balance is what shifts across the economy.
        </p>
        {sectors.map((s) => (
          <SectorSplitRow key={s.gicsCode} sector={s} />
        ))}
        <PillarLegend />
        <TableView
          head={["Sector", "Environmental", "Social", "Governance"]}
          rows={sectors.map((s) => {
            const sp = pillarSplit(s);
            return [s.name, `${fmtWeight(sp.environmental)}%`, `${fmtWeight(sp.social)}%`, `${fmtWeight(sp.governance)}%`];
          })}
        />
      </Card>
    </div>
  );
}
