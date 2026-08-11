"use client";

/**
 * Faceted filter panel for the Jobs CMS. The whole corpus is already in the
 * client (same "load it all into JS" house pattern as the BRSR directory), so
 * facets are derived from the rows rather than queried — every option carries
 * the count it would yield, computed with the *other* filters applied so the
 * numbers stay honest as you drill down.
 */

import { CaretDown, Funnel, X } from "@phosphor-icons/react/dist/ssr";
import type { JobRow, JobSeniority } from "@/lib/db/jobs";

/** Sentinel for rows where the facet field is empty — surfaces gaps in the data. */
export const UNSET = "__unset";
const ALL = "all";

export interface JobFilters {
  country: string;
  company: string;
  employmentType: string;
  seniority: string;
  /** AND-matched: a row must carry every selected tag. */
  tags: string[];
}

export const EMPTY_JOB_FILTERS: JobFilters = {
  country: ALL,
  company: ALL,
  employmentType: ALL,
  seniority: ALL,
  tags: [],
};

type FacetKey = "country" | "company" | "employmentType" | "seniority" | "tags";

const SENIORITY_LABELS: Record<JobSeniority, string> = {
  entry: "Entry",
  mid: "Mid",
  senior: "Senior",
  lead: "Lead",
};

const FACET_LABELS: Record<FacetKey, string> = {
  country: "Country",
  company: "Company",
  employmentType: "Employment type",
  seniority: "Seniority",
  tags: "Tag",
};

const selectCls =
  "w-full appearance-none rounded-lg border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-green-500";
const facetLabelCls = "text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500";

/** The row's value for a facet, or UNSET when the field is empty. */
function facetValue(job: JobRow, key: Exclude<FacetKey, "tags">): string {
  const raw =
    key === "country"
      ? job.country
      : key === "company"
        ? job.company
        : key === "employmentType"
          ? job.employment_type
          : job.seniority;
  return raw?.trim() ? raw.trim() : UNSET;
}

function optionLabel(key: Exclude<FacetKey, "tags">, value: string): string {
  if (value === UNSET) return "Unspecified";
  if (key === "seniority") return SENIORITY_LABELS[value as JobSeniority] ?? value;
  return value;
}

/**
 * Does a row pass the filters? `except` skips one facet, which is how each
 * facet counts its own options against everything *else* that is selected.
 */
export function jobMatchesFilters(job: JobRow, filters: JobFilters, except?: FacetKey): boolean {
  if (except !== "country" && filters.country !== ALL && facetValue(job, "country") !== filters.country) return false;
  if (except !== "company" && filters.company !== ALL && facetValue(job, "company") !== filters.company) return false;
  if (
    except !== "employmentType" &&
    filters.employmentType !== ALL &&
    facetValue(job, "employmentType") !== filters.employmentType
  )
    return false;
  if (except !== "seniority" && filters.seniority !== ALL && facetValue(job, "seniority") !== filters.seniority)
    return false;
  if (except !== "tags" && filters.tags.length > 0) {
    const own = new Set(job.tags.map((t) => t.toLowerCase()));
    if (!filters.tags.every((t) => own.has(t.toLowerCase()))) return false;
  }
  return true;
}

export function activeFilterCount(filters: JobFilters): number {
  let n = 0;
  if (filters.country !== ALL) n += 1;
  if (filters.company !== ALL) n += 1;
  if (filters.employmentType !== ALL) n += 1;
  if (filters.seniority !== ALL) n += 1;
  n += filters.tags.length;
  return n;
}

interface Option {
  value: string;
  label: string;
  count: number;
}

/** Options for one select, counted against every other active filter. */
function selectOptions(base: JobRow[], filters: JobFilters, key: Exclude<FacetKey, "tags">): Option[] {
  const counts = new Map<string, number>();
  for (const job of base) {
    if (!jobMatchesFilters(job, filters, key)) continue;
    const value = facetValue(job, key);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  // Keep the current selection visible even when it now counts zero, so the
  // control never silently loses its own value.
  const selected = filters[key];
  if (selected !== ALL && !counts.has(selected)) counts.set(selected, 0);

  const options = [...counts.entries()].map(([value, count]) => ({ value, label: optionLabel(key, value), count }));
  if (key === "seniority") {
    const order = ["entry", "mid", "senior", "lead", UNSET];
    return options.sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value));
  }
  return options.sort((a, b) => {
    if (a.value === UNSET) return 1;
    if (b.value === UNSET) return -1;
    return a.label.localeCompare(b.label);
  });
}

/** Tag options, most-used first, counted against every other active filter. */
function tagOptions(base: JobRow[], filters: JobFilters): Option[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const job of base) {
    if (!jobMatchesFilters(job, filters, "tags")) continue;
    for (const tag of new Set(job.tags.map((t) => t.trim()).filter(Boolean))) {
      const key = tag.toLowerCase();
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { label: tag, count: 1 });
    }
  }
  for (const tag of filters.tags) {
    const key = tag.toLowerCase();
    if (!counts.has(key)) counts.set(key, { label: tag, count: 0 });
  }
  return [...counts.values()]
    .map((entry) => ({ value: entry.label, label: entry.label, count: entry.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function FacetSelect({
  label,
  allLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className={facetLabelCls}>{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={selectCls}
          disabled={options.length === 0}
        >
          <option value={ALL}>{allLabel}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} · {option.count}
            </option>
          ))}
        </select>
        <CaretDown
          size={12}
          weight="bold"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
      </span>
    </label>
  );
}

/** Removable summary of what is currently narrowing the table. */
function ActiveChips({
  filters,
  onChange,
  spaced,
}: {
  filters: JobFilters;
  onChange: (next: JobFilters) => void;
  /** The open panel already leaves a gap above; only pad when it is collapsed. */
  spaced: boolean;
}) {
  const chips: { key: string; label: string; clear: () => void }[] = [];
  const push = (key: Exclude<FacetKey, "tags">) => {
    const value = filters[key];
    if (value === ALL) return;
    chips.push({
      key,
      label: `${FACET_LABELS[key]}: ${optionLabel(key, value)}`,
      clear: () => onChange({ ...filters, [key]: ALL }),
    });
  };
  push("country");
  push("company");
  push("employmentType");
  push("seniority");
  for (const tag of filters.tags) {
    chips.push({
      key: `tag:${tag}`,
      label: `Tag: ${tag}`,
      clear: () => onChange({ ...filters, tags: filters.tags.filter((t) => t !== tag) }),
    });
  }
  if (chips.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 px-5 pb-4 ${spaced ? "pt-3" : ""}`}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.clear}
          className="inline-flex items-center gap-1 rounded-pill border border-teal-900/15 bg-teal-900/5 px-2.5 py-1 text-[11.5px] font-medium text-teal-900 transition-colors hover:bg-teal-900/10"
        >
          {chip.label}
          <X size={10} weight="bold" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(EMPTY_JOB_FILTERS)}
        className="rounded-pill px-2 py-1 text-[11.5px] font-medium text-gray-500 transition-colors hover:text-ink"
      >
        Clear all
      </button>
    </div>
  );
}

/** Toggle that opens the panel, badged with how many filters are active. */
export function JobsFilterToggle({
  open,
  onToggle,
  activeCount,
}: {
  open: boolean;
  onToggle: () => void;
  activeCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={
        open || activeCount > 0
          ? "inline-flex items-center gap-1.5 rounded-pill border border-teal-900 bg-teal-900 px-3 py-1 text-[12px] font-semibold text-white"
          : "inline-flex items-center gap-1.5 rounded-pill border border-gray-200 bg-white px-3 py-1 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
      }
    >
      <Funnel size={12} weight={activeCount > 0 ? "fill" : "regular"} /> Filters
      {activeCount > 0 ? (
        <span className="rounded-pill bg-white/20 px-1.5 text-[11px] font-semibold tabular-nums">{activeCount}</span>
      ) : null}
    </button>
  );
}

export function JobsFilterPanel({
  open,
  base,
  filters,
  onChange,
  matchCount,
}: {
  open: boolean;
  /** Rows the status tab + search already kept — facets count within these. */
  base: JobRow[];
  filters: JobFilters;
  onChange: (next: JobFilters) => void;
  matchCount: number;
}) {
  const active = activeFilterCount(filters);
  if (!open && active === 0) return null;

  const tags = tagOptions(base, filters);
  const toggleTag = (tag: string) =>
    onChange({
      ...filters,
      tags: filters.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
        ? filters.tags.filter((t) => t.toLowerCase() !== tag.toLowerCase())
        : [...filters.tags, tag],
    });

  return (
    <div className="border-b border-gray-100">
      {open ? (
        <div className="grid gap-3 px-5 pb-4 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <FacetSelect
            label={FACET_LABELS.country}
            allLabel="All countries"
            value={filters.country}
            options={selectOptions(base, filters, "country")}
            onChange={(country) => onChange({ ...filters, country })}
          />
          <FacetSelect
            label={FACET_LABELS.company}
            allLabel="All companies"
            value={filters.company}
            options={selectOptions(base, filters, "company")}
            onChange={(company) => onChange({ ...filters, company })}
          />
          <FacetSelect
            label={FACET_LABELS.employmentType}
            allLabel="All types"
            value={filters.employmentType}
            options={selectOptions(base, filters, "employmentType")}
            onChange={(employmentType) => onChange({ ...filters, employmentType })}
          />
          <FacetSelect
            label={FACET_LABELS.seniority}
            allLabel="All levels"
            value={filters.seniority}
            options={selectOptions(base, filters, "seniority")}
            onChange={(seniority) => onChange({ ...filters, seniority })}
          />

          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
            <span className={facetLabelCls}>Tags</span>
            {tags.length === 0 ? (
              <span className="text-[12.5px] text-gray-500">No tags on these jobs yet.</span>
            ) : (
              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {tags.map((tag) => {
                  const on = filters.tags.some((t) => t.toLowerCase() === tag.value.toLowerCase());
                  return (
                    <button
                      key={tag.value}
                      type="button"
                      onClick={() => toggleTag(tag.value)}
                      aria-pressed={on}
                      className={
                        on
                          ? "rounded-pill bg-teal-900 px-2.5 py-1 text-[11.5px] font-semibold text-white"
                          : "rounded-pill border border-gray-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
                      }
                    >
                      {tag.label} <span className="tabular-nums opacity-60">{tag.count}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <span className="mt-1 text-[11.5px] text-gray-500">
              {matchCount} job{matchCount === 1 ? "" : "s"} match{active > 0 ? " these filters" : ""}.
            </span>
          </div>
        </div>
      ) : null}

      <ActiveChips filters={filters} onChange={onChange} spaced={!open} />
    </div>
  );
}
