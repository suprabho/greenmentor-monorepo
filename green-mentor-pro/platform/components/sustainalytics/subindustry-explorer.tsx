"use client";

import { useMemo, useState } from "react";
import { CaretRight, MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import type { SubindustryView } from "@/lib/sustainalytics/repo";

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

function SubindustryRow({ s, q, open, onToggle }: { s: SubindustryView; q: string; open: boolean; onToggle: () => void }) {
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
      >
        <CaretRight
          weight="bold"
          className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="flex-1 text-[14px] font-semibold text-ink">
          <Highlight text={s.name} q={q} />
        </span>
        {s.nic && (
          <Chip tone={CONFIDENCE_TONE[s.nic.confidence]} className="hidden sm:inline-flex" >
            NIC {s.nic.section} · {s.nic.division}
          </Chip>
        )}
        <span className="text-[12px] tabular-nums text-gray-500">{s.meis.length} MEIs</span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 py-3">
          {s.nic && (
            <p className="mb-2 text-[12px] text-gray-600">
              Sector <span className="font-medium text-gray-800">{s.nic.section} — {s.nic.sectionTitle}</span>
              {" · "}Industry <span className="font-medium text-gray-800">{s.nic.division} — {s.nic.divisionTitle}</span>
              {s.nic.confidence !== "high" && <span className="text-gray-400"> ({s.nic.confidence} confidence)</span>}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {s.meis.map((m) => (
              <Chip key={m.code} tone="teal">
                <Highlight text={m.name} q={q} />
              </Chip>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export function SubindustryExplorer({ subindustries }: { subindustries: SubindustryView[] }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const q = query.trim().toLowerCase();

  const visible = useMemo(() => {
    if (!q) return subindustries;
    return subindustries.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.nic?.sectionTitle.toLowerCase().includes(q) ||
        s.meis.some((m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q)),
    );
  }, [q, subindustries]);

  const toggle = (slug: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
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
            placeholder="Search a subindustry or material issue…"
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
          {visible.length} / {subindustries.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <Card className="p-6 text-[13.5px] text-gray-600">No subindustry or material issue matches “{query}”.</Card>
      ) : (
        <div className="space-y-2">
          {visible.map((s) => (
            <SubindustryRow key={s.slug} s={s} q={q} open={q ? true : expanded.has(s.slug)} onToggle={() => toggle(s.slug)} />
          ))}
        </div>
      )}
    </div>
  );
}
