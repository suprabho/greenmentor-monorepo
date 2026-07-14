/**
 * NIC-2008 classification dashboard — pure server-rendered presentation for
 * /nic. Follows the house chart idiom (see components/brsr/brsr-dashboard.tsx
 * and the pipeline page): dependency-free flex/inline-style marks, thin bars
 * with 4px rounded data-ends, CSS-only hover/focus tooltips in the teal bubble,
 * values in text tokens, and a <details> table view under every chart so
 * nothing is gated behind hover. This app is light-only.
 *
 * Series hues are the three-sector economic model (primary / secondary /
 * tertiary), coloured with validated dataviz categorical slots 1–3 defined in
 * lib/nic/classification.ts. Aqua and yellow sit below 3:1 on white, so every
 * bar is direct-labelled and every chart has a table view (the relief rule).
 */
import { Card, Stat } from "@/components/ui";
import {
  NIC_SECTIONS,
  NIC_TOTALS,
  SUPER_SECTORS,
  SUPER_SECTOR_ORDER,
  groupCount,
  superSectorRollup,
  type NicSection,
} from "@/lib/nic/classification";

const full = (n: number) => n.toLocaleString("en-IN");

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

/** Square section-letter chip in its super-sector hue. */
function LetterBadge({ letter, hue, size = 22 }: { letter: string; hue: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[6px] font-semibold text-white"
      style={{ width: size, height: size, background: hue, fontSize: Math.round(size * 0.5) }}
      aria-hidden
    >
      {letter}
    </span>
  );
}

/** The legend + three-sector blurbs — also the colour key for the bar chart. */
function SuperSectorLegend() {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      {SUPER_SECTOR_ORDER.map((sector) => {
        const m = SUPER_SECTORS[sector];
        return (
          <div key={sector} className="flex gap-2">
            <span className="mt-[3px] size-3 shrink-0 rounded-[3px]" style={{ background: m.hue }} />
            <span className="text-[12px] leading-snug">
              <span className="font-semibold text-ink">{m.label}</span>
              <span className="text-gray-500"> — {m.blurb}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** One horizontal 100%-stacked bar split into the three super-sectors. */
function SplitBar({
  label,
  total,
  parts,
  unit,
}: {
  label: string;
  total: number;
  parts: { sector: (typeof SUPER_SECTOR_ORDER)[number]; value: number }[];
  unit: string;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[12.5px] font-medium text-ink">{label}</span>
        <span className="text-[12px] tabular-nums text-gray-500">
          {full(total)} {unit}
        </span>
      </div>
      <div className="flex h-5 w-full gap-[2px] overflow-hidden rounded-[5px]">
        {parts.map((p) => {
          const pct = (100 * p.value) / total;
          const m = SUPER_SECTORS[p.sector];
          return (
            <span
              key={p.sector}
              className="group relative grid h-5 place-items-center"
              style={{ width: `${pct}%`, background: m.hue, minWidth: p.value > 0 ? 22 : 0 }}
              tabIndex={0}
              aria-label={`${m.label}: ${p.value} ${unit} (${Math.round(pct)}%)`}
            >
              <Tooltip>
                {m.label} · {full(p.value)} {unit} ({Math.round(pct)}%)
              </Tooltip>
              {pct >= 7 && <span className="text-[10.5px] font-semibold tabular-nums text-white">{p.value}</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** One row of the industries-per-sector chart. */
function SectorBar({ section, maxDiv }: { section: NicSection; maxDiv: number }) {
  const divs = section.divisions.length;
  const grps = groupCount(section);
  const m = SUPER_SECTORS[section.superSector];
  const w = (100 * divs) / maxDiv;
  return (
    <div
      className="group relative grid items-center gap-3 py-[3px] grid-cols-[minmax(0,248px)_1fr_84px]"
      tabIndex={0}
      aria-label={`Section ${section.letter}, ${section.title}: ${divs} industries, ${grps} groups (${m.label})`}
    >
      <Tooltip>
        {section.letter} · {section.title} — {m.label} · {full(divs)} industries · {full(grps)} groups
      </Tooltip>
      <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-ink">
        <LetterBadge letter={section.letter} hue={m.hue} />
        <span className="truncate">{section.title}</span>
      </span>
      <span className="flex h-4 items-center border-l border-[#c3c2b7]">
        <span className="h-4 rounded-r-[4px]" style={{ width: `${Math.max(w, 0.6)}%`, background: m.hue }} />
      </span>
      <span className="text-right text-[12px] tabular-nums text-gray-600">
        {full(divs)} <span className="text-gray-400">· {full(grps)}g</span>
      </span>
    </div>
  );
}

export function NicDashboard() {
  const rollup = superSectorRollup();
  const maxDiv = Math.max(...NIC_SECTIONS.map((s) => s.divisions.length));

  return (
    <div>
      {/* hierarchy totals */}
      <SectionHeading note="five-level hierarchy, top three enumerated">Classification at a glance</SectionHeading>
      <Card className="mb-6 grid grid-cols-2 gap-y-5 p-5 sm:grid-cols-5">
        <Stat label="Sections" value={full(NIC_TOTALS.sections)} sub="A–U · sectors" />
        <Stat label="Divisions" value={full(NIC_TOTALS.divisions)} sub="2-digit · industries" />
        <Stat label="Groups" value={full(NIC_TOTALS.groups)} sub="3-digit" />
        <Stat label="Classes" value={full(NIC_TOTALS.classes)} sub="4-digit · documented" />
        <Stat label="Sub-classes" value={full(NIC_TOTALS.subClasses)} sub="5-digit · documented" />
      </Card>

      {/* three-sector split — doubles as the chart's colour legend */}
      <SectionHeading note="the ILO primary / secondary / tertiary model NIC cites">
        How the economy splits
      </SectionHeading>
      <Card className="mb-6 p-5">
        <SplitBar
          label="Sectors (sections)"
          total={NIC_TOTALS.sections}
          unit="sectors"
          parts={rollup.map((r) => ({ sector: r.sector, value: r.sections }))}
        />
        <SplitBar
          label="Industries (divisions)"
          total={NIC_TOTALS.divisions}
          unit="industries"
          parts={rollup.map((r) => ({ sector: r.sector, value: r.divisions }))}
        />
        <SplitBar
          label="Groups"
          total={NIC_TOTALS.groups}
          unit="groups"
          parts={rollup.map((r) => ({ sector: r.sector, value: r.groups }))}
        />
        <SuperSectorLegend />
        <TableView
          head={["Super-sector", "Sectors", "Industries", "Groups"]}
          rows={rollup.map((r) => [SUPER_SECTORS[r.sector].label, r.sections, r.divisions, r.groups])}
        />
      </Card>

      {/* industries per sector */}
      <SectionHeading note="bar = industries (divisions) · value = industries · groups">
        Industries per sector
      </SectionHeading>
      <Card className="mb-6 p-5">
        <p className="mb-3 text-[12px] text-gray-500">
          Manufacturing (C) alone spans {full(maxDiv)} of the 88 industries — more than every primary sector combined.
          Bars are coloured by super-sector; sections keep their canonical A–U order.
        </p>
        {NIC_SECTIONS.map((s) => (
          <SectorBar key={s.letter} section={s} maxDiv={maxDiv} />
        ))}
        <TableView
          head={["Section", "Sector", "Industries", "Groups"]}
          rows={NIC_SECTIONS.map((s) => [
            `${s.letter} · ${s.title}`,
            SUPER_SECTORS[s.superSector].label,
            s.divisions.length,
            groupCount(s),
          ])}
        />
      </Card>
    </div>
  );
}
