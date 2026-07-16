"use client";

import { useMemo, useState } from "react";
import { CaretRight, MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import type { IndustryView, MaterialIssue } from "@/lib/sasb/repo";
import { DIMENSION_ORDER, dimensionMeta } from "@/lib/sasb/dimensions";

/** Wrap the matched substring in a highlight mark. */
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[3px] bg-green-100 px-0.5 text-ink">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

const CONFIDENCE_TONE: Record<"high" | "medium" | "low", "green" | "warn" | "neutral"> = {
  high: "green",
  medium: "warn",
  low: "neutral",
};

/** Material issues grouped by dimension, in canonical dimension order. */
function groupByDimension(issues: MaterialIssue[]): [string, MaterialIssue[]][] {
  const by = new Map<string, MaterialIssue[]>();
  for (const g of issues) {
    let list = by.get(g.dimension);
    if (!list) by.set(g.dimension, (list = []));
    list.push(g);
  }
  return DIMENSION_ORDER.filter((d) => by.has(d)).map((d) => [d, by.get(d)!]);
}

function IssueBlock({ issue, q }: { issue: MaterialIssue; q: string }) {
  return (
    <div>
      <div className="text-[13px] font-semibold text-ink">
        <Highlight text={issue.name} q={q} />
        <span className="ml-1.5 text-[11px] font-normal tabular-nums text-gray-400">{issue.code}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {issue.topics.map((t) => (
          <Chip key={t.code} tone="neutral" className="font-medium" >
            <Highlight text={t.name} q={q} />
          </Chip>
        ))}
      </div>
    </div>
  );
}

function IndustryRow({ ind, q, open, onToggle }: { ind: IndustryView; q: string; open: boolean; onToggle: () => void }) {
  const grouped = groupByDimension(ind.issues);
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
      >
        <CaretRight weight="bold" className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-ink">
            <Highlight text={ind.name} q={q} />
          </span>
          <span className="block truncate text-[12px] text-gray-500">
            {ind.code} · {ind.sector}
          </span>
        </span>
        {ind.nic && (
          <Chip tone={CONFIDENCE_TONE[ind.nic.confidence]} className="hidden sm:inline-flex">
            NIC {ind.nic.section} · {ind.nic.division}
          </Chip>
        )}
        <span className="shrink-0 text-[12px] tabular-nums text-gray-500">{ind.issues.length} issues</span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 py-3">
          {ind.nic && (
            <p className="mb-3 text-[12px] text-gray-600">
              Sector <span className="font-medium text-gray-800">{ind.nic.section} — {ind.nic.sectionTitle}</span>
              {" · "}Industry <span className="font-medium text-gray-800">{ind.nic.division} — {ind.nic.divisionTitle}</span>
              {ind.nic.confidence !== "high" && <span className="text-gray-400"> ({ind.nic.confidence} confidence)</span>}
            </p>
          )}
          <div className="space-y-4">
            {grouped.map(([dim, issues]) => {
              const meta = dimensionMeta(dim);
              return (
                <div key={dim} className="border-l-2 pl-3" style={{ borderColor: meta.hue }}>
                  <div className="mb-2 flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: meta.hue }} />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">{dim}</span>
                  </div>
                  <div className="space-y-2.5">
                    {issues.map((g) => (
                      <IssueBlock key={g.code} issue={g} q={q} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

export function IndustryExplorer({ industries }: { industries: IndustryView[] }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const q = query.trim().toLowerCase();

  const visible = useMemo(() => {
    if (!q) return industries;
    return industries.filter(
      (ind) =>
        ind.name.toLowerCase().includes(q) ||
        ind.sector.toLowerCase().includes(q) ||
        ind.nic?.sectionTitle.toLowerCase().includes(q) ||
        ind.issues.some(
          (g) =>
            g.name.toLowerCase().includes(q) ||
            g.topics.some((t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)),
        ),
    );
  }, [q, industries]);

  const toggle = (code: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search an industry, sector, issue or disclosure topic…"
            className="w-full rounded-pill border border-gray-200 bg-white py-2 pl-9 pr-9 text-[13.5px] outline-none focus:border-green-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X />
            </button>
          )}
        </div>
        <span className="shrink-0 text-[12px] tabular-nums text-gray-500">
          {visible.length} / {industries.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <Card className="p-6 text-[13.5px] text-gray-600">No industry, issue or topic matches “{query}”.</Card>
      ) : (
        <div className="space-y-2">
          {visible.map((ind) => (
            <IndustryRow key={ind.code} ind={ind} q={q} open={q ? true : expanded.has(ind.code)} onToggle={() => toggle(ind.code)} />
          ))}
        </div>
      )}
    </div>
  );
}
