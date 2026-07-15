"use client";

/**
 * MSCI materiality map explorer — the interactive core of /materiality, a faithful
 * rebuild of MSCI's own tool: pick a GICS sector (or drill to a sub-industry) and
 * see its material Key Issues as weighted bars grouped by E/S/G pillar.
 *
 * House idiom: dependency-free inline-style bars with rounded data-ends, teal
 * -bubble CSS tooltips, values in text tokens, a table view under the chart. Bars
 * share a FIXED scale so weights are comparable across selections. Pillar hues are
 * validated categorical slots; a "CS" chip marks company-specific Key Issues
 * (MSCI applies them to only a subset of companies in the industry).
 */
import { useMemo, useState } from "react";
import type { MsciPillar } from "@/lib/msci/materiality-map";
import { PILLAR_META, PILLAR_ORDER, fmtWeight } from "./pillars";

export type ExplorerIssue = { id: string; name: string; description: string; pillar: MsciPillar };
export type ExplorerIndustry = {
  gicsCode: string;
  name: string;
  level: "sector" | "sub-industry";
  sectorCode: string;
  weights: number[];
  relevance: number[];
};

/** Fixed bar scale (%). Above the global max single-issue weight (~36) so bars never clip. */
const SCALE = 40;

type Row = { issue: ExplorerIssue; weight: number; companySpecific: boolean };

function IssueBar({ row }: { row: Row }) {
  const m = PILLAR_META[row.issue.pillar];
  const w = Math.max((row.weight / SCALE) * 100, 1.5);
  return (
    <div
      className="group relative grid items-center gap-3 py-[3px] grid-cols-[minmax(0,220px)_1fr_46px]"
      tabIndex={0}
      aria-label={`${row.issue.name}: ${fmtWeight(row.weight)}% weight${row.companySpecific ? " (company-specific)" : ""}`}
    >
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-8 left-2 z-10 max-w-[320px] whitespace-normal rounded-md bg-teal-900 px-2 py-1 text-[11px] font-medium leading-snug text-white opacity-0 shadow-soft transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {row.issue.name} — {row.issue.description}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink">
        <span className="truncate">{row.issue.name}</span>
        {row.companySpecific && (
          <span
            className="shrink-0 rounded-[3px] bg-gray-100 px-1 text-[9.5px] font-semibold tracking-wide text-gray-500"
            title="Company-specific — MSCI applies this Key Issue to only some companies in the industry"
          >
            CS
          </span>
        )}
      </span>
      <span className="flex h-4 items-center border-l border-[#e5e4dd]">
        <span className="h-4 rounded-r-[4px]" style={{ width: `${w}%`, background: m.hue }} />
      </span>
      <span className="text-right text-[12px] font-medium tabular-nums text-gray-700">{fmtWeight(row.weight)}%</span>
    </div>
  );
}

export function MaterialityExplorer({
  industries,
  issuesByCol,
}: {
  industries: ExplorerIndustry[];
  issuesByCol: ExplorerIssue[];
}) {
  const sectors = useMemo(() => industries.filter((i) => i.level === "sector"), [industries]);
  const subsBySector = useMemo(() => {
    const m = new Map<string, ExplorerIndustry[]>();
    for (const ind of industries) {
      if (ind.level !== "sub-industry") continue;
      (m.get(ind.sectorCode) ?? m.set(ind.sectorCode, []).get(ind.sectorCode)!).push(ind);
    }
    return m;
  }, [industries]);
  const byGics = useMemo(() => new Map(industries.map((i) => [i.gicsCode, i])), [industries]);

  const [sectorCode, setSectorCode] = useState(sectors[0]?.gicsCode ?? "");
  // "" = show the whole sector; otherwise an 8-digit sub-industry code.
  const [subGics, setSubGics] = useState("");

  const selected = byGics.get(subGics || sectorCode);
  const subs = subsBySector.get(sectorCode) ?? [];

  const rows: Row[] = useMemo(() => {
    if (!selected) return [];
    const out: Row[] = [];
    issuesByCol.forEach((issue, col) => {
      const weight = selected.weights[col] ?? 0;
      if (weight <= 0) return;
      const companySpecific = selected.level === "sub-industry" && selected.relevance[col] !== 1;
      out.push({ issue, weight, companySpecific });
    });
    return out.sort((a, b) => b.weight - a.weight);
  }, [selected, issuesByCol]);

  const pillarTotal = (p: MsciPillar) =>
    rows.filter((r) => r.issue.pillar === p).reduce((s, r) => s + r.weight, 0);

  const selectCls =
    "rounded-[9px] border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-ink outline-none focus:border-teal-500";

  return (
    <div>
      {/* controls — one row above the chart */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          aria-label="GICS sector"
          className={selectCls}
          value={sectorCode}
          onChange={(e) => {
            setSectorCode(e.target.value);
            setSubGics("");
          }}
        >
          {sectors.map((s) => (
            <option key={s.gicsCode} value={s.gicsCode}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          aria-label="GICS sub-industry"
          className={selectCls}
          value={subGics}
          onChange={(e) => setSubGics(e.target.value)}
        >
          <option value="">— Whole sector —</option>
          {subs.map((s) => (
            <option key={s.gicsCode} value={s.gicsCode}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <div>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-[13px] text-gray-600">
              <span className="font-semibold text-ink">{selected.name}</span>{" "}
              <span className="text-gray-400">
                · GICS {selected.gicsCode} · {selected.level === "sector" ? "sector" : "sub-industry"}
              </span>
            </div>
            <div className="text-[12px] text-gray-500">{rows.length} material Key Issues</div>
          </div>

          {PILLAR_ORDER.map((p) => {
            const pillarRows = rows.filter((r) => r.issue.pillar === p);
            if (pillarRows.length === 0) return null;
            const m = PILLAR_META[p];
            return (
              <div key={p} className="mb-4 last:mb-0">
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="size-2.5 rounded-[3px]" style={{ background: m.hue }} />
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{m.label}</h3>
                  <span className="text-[12px] tabular-nums text-gray-400">{fmtWeight(pillarTotal(p))}%</span>
                </div>
                {pillarRows.map((r) => (
                  <IssueBar key={r.issue.id} row={r} />
                ))}
              </div>
            );
          })}

          <p className="mt-3 text-[11.5px] text-gray-400">
            <span className="rounded-[3px] bg-gray-100 px-1 font-semibold text-gray-500">CS</span> = company-specific:
            MSCI applies the Key Issue to only some companies in the industry, so its average weight understates its
            impact on the affected companies.
          </p>

          <details className="mt-3">
            <summary className="cursor-pointer text-[12px] text-gray-500">Table view</summary>
            <table className="mt-2 w-full text-[12px]">
              <thead>
                <tr>
                  {["Key Issue", "Pillar", "Weight", "Company-specific"].map((h, i) => (
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
                {rows.map((r) => (
                  <tr key={r.issue.id}>
                    <td className="border-b border-gray-100 py-1 pr-3 text-left text-ink">{r.issue.name}</td>
                    <td className="border-b border-gray-100 py-1 pr-3 text-right text-gray-600">
                      {PILLAR_META[r.issue.pillar].label}
                    </td>
                    <td className="border-b border-gray-100 py-1 pr-3 text-right tabular-nums text-gray-600">
                      {fmtWeight(r.weight)}%
                    </td>
                    <td className="border-b border-gray-100 py-1 pr-3 text-right text-gray-600">
                      {r.companySpecific ? "yes" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}
    </div>
  );
}
