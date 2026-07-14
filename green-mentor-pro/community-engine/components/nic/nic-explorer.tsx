"use client";

/**
 * Explorable NIC-2008 tree — the full scraped Section → Division → Group
 * classification, browsable with a live search across every code and title.
 * A client island (the rest of /nic is server-rendered): search needs to
 * force-open matching branches, so this uses controlled disclosure rather than
 * native <details>. Colours follow the super-sector key from the dashboard.
 */
import { useMemo, useState } from "react";
import { CaretRight, MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import {
  NIC_SECTIONS,
  SUPER_SECTORS,
  groupCount,
  type NicGroup,
  type NicSection,
} from "@/lib/nic/classification";

/** One division's visible rows under the active query (all groups, or the matching subset). */
interface VisibleDivision {
  code: string;
  title: string;
  groups: NicGroup[];
}
interface VisibleSection {
  section: NicSection;
  divisions: VisibleDivision[];
}

/** Highlight the first case-insensitive occurrence of `q` in `text`. */
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q);
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[3px] bg-green-100 px-0.5 text-ink">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/** Which divisions/groups of a section survive the query, or null if none do. */
function visibleFor(section: NicSection, q: string): VisibleDivision[] | null {
  const sectionHit = section.title.toLowerCase().includes(q) || section.letter.toLowerCase() === q;
  const out: VisibleDivision[] = [];
  for (const d of section.divisions) {
    const divHit = d.code.startsWith(q) || d.title.toLowerCase().includes(q);
    if (sectionHit || divHit) {
      out.push({ code: d.code, title: d.title, groups: d.groups });
      continue;
    }
    const matched = d.groups.filter((g) => g.code.startsWith(q) || g.title.toLowerCase().includes(q));
    if (matched.length) out.push({ code: d.code, title: d.title, groups: matched });
  }
  return out.length ? out : null;
}

function GroupList({ groups, q }: { groups: NicGroup[]; q: string }) {
  return (
    <ul className="mt-1.5 grid gap-x-6 gap-y-1 sm:grid-cols-2">
      {groups.map((g) => (
        <li key={g.code} className="flex gap-2 text-[12.5px] leading-snug">
          <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-gray-400">
            <Highlight text={g.code} q={q} />
          </span>
          <span className="min-w-0 text-gray-700">
            <Highlight text={g.title} q={q} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function SectionBlock({
  vs,
  open,
  onToggle,
  q,
}: {
  vs: VisibleSection;
  open: boolean;
  onToggle: () => void;
  q: string;
}) {
  const { section } = vs;
  const m = SUPER_SECTORS[section.superSector];
  const shownGroups = vs.divisions.reduce((n, d) => n + d.groups.length, 0);
  return (
    <div className="overflow-hidden rounded-[14px] border border-gray-200 bg-white shadow-soft">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
      >
        <CaretRight
          size={13}
          weight="bold"
          className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span
          className="grid size-7 shrink-0 place-items-center rounded-[7px] text-[13px] font-semibold text-white"
          style={{ background: m.hue }}
          aria-hidden
        >
          {section.letter}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-ink">
            <span className="text-gray-400">{section.letter} · </span>
            <Highlight text={section.title} q={q} />
          </span>
          <span className="text-[11.5px] text-gray-500">
            {m.label} · {section.divisions.length} industr{section.divisions.length === 1 ? "y" : "ies"} ·{" "}
            {groupCount(section)} group{groupCount(section) === 1 ? "" : "s"}
            {q && shownGroups !== groupCount(section) ? ` · ${shownGroups} matching` : ""}
          </span>
        </span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="space-y-3">
            {vs.divisions.map((d) => (
              <div key={d.code} className="border-l-2 pl-3" style={{ borderColor: m.hue }}>
                <div className="flex gap-2 text-[13px]">
                  <span className="shrink-0 font-mono text-[12px] tabular-nums text-gray-500">
                    <Highlight text={d.code} q={q} />
                  </span>
                  <span className="min-w-0 font-medium text-ink">
                    <Highlight text={d.title} q={q} />
                  </span>
                </div>
                <GroupList groups={d.groups} q={q} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function NicExplorer() {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const q = query.trim().toLowerCase();

  const visible = useMemo<VisibleSection[]>(() => {
    if (!q) return NIC_SECTIONS.map((section) => ({ section, divisions: section.divisions }));
    const out: VisibleSection[] = [];
    for (const section of NIC_SECTIONS) {
      const divisions = visibleFor(section, q);
      if (divisions) out.push({ section, divisions });
    }
    return out;
  }, [q]);

  const summary = useMemo(() => {
    const sections = visible.length;
    const divisions = visible.reduce((n, v) => n + v.divisions.length, 0);
    const groups = visible.reduce((n, v) => n + v.divisions.reduce((g, d) => g + d.groups.length, 0), 0);
    return { sections, divisions, groups };
  }, [visible]);

  const allLetters = NIC_SECTIONS.map((s) => s.letter);
  const allExpanded = expanded.size === allLetters.length;

  const toggle = (letter: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <MagnifyingGlass
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 88 industries and 238 groups — try “textile”, “solar”, 351…"
            aria-label="Search the NIC-2008 classification"
            className="h-9 w-full rounded-pill border border-gray-200 bg-white pl-9 pr-9 text-[13px] text-ink outline-none placeholder:text-gray-400 focus:border-green-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-ink"
            >
              <X size={12} weight="bold" />
            </button>
          )}
        </div>
        {!q && (
          <button
            type="button"
            onClick={() => setExpanded(allExpanded ? new Set() : new Set(allLetters))}
            className="rounded-pill border border-gray-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      {q && (
        <p className="mb-3 text-[12px] text-gray-500">
          {summary.sections === 0
            ? "No matches — try a shorter term or a code like 131."
            : `${summary.sections} sector${summary.sections === 1 ? "" : "s"} · ${summary.divisions} industr${summary.divisions === 1 ? "y" : "ies"} · ${summary.groups} group${summary.groups === 1 ? "" : "s"} matching`}
        </p>
      )}

      <div className="space-y-2.5">
        {visible.map((vs) => (
          <SectionBlock
            key={vs.section.letter}
            vs={vs}
            q={q}
            open={q ? true : expanded.has(vs.section.letter)}
            onToggle={() => toggle(vs.section.letter)}
          />
        ))}
      </div>
    </div>
  );
}
