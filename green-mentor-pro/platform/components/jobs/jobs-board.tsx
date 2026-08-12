"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Briefcase,
  Clock,
  CalendarBlank,
  ArrowSquareOut,
  MagnifyingGlass,
} from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import { ShareButton } from "@/components/share/share-button";
import { jobHref } from "@/lib/share/href";
import type { Job, JobSeniority } from "@/lib/jobs/repo";

const SENIORITY_FILTERS: { value: "all" | JobSeniority; label: string }[] = [
  { value: "all", label: "All levels" },
  { value: "entry", label: "Entry" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
];

type RangeRelation = "all" | "today" | "lastweek" | "lastmonth";

const RANGE_FILTERS: { value: RangeRelation; label: string; days: number | null }[] = [
  { value: "all", label: "Any time", days: null },
  { value: "today", label: "Today", days: 0 },
  { value: "lastweek", label: "Last week", days: 7 },
  { value: "lastmonth", label: "Last month", days: 30 },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** yyyy-mm-dd `days` ago in the viewer's timezone — postedOn is a bare date. */
function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function matchesRange(job: Job, range: RangeRelation): boolean {
  if (range === "all") return true;
  if (!job.postedOn) return false;
  const days = RANGE_FILTERS.find((r) => r.value === range)?.days ?? null;
  return days === null ? true : job.postedOn >= daysAgoIso(days);
}

/** Format an ISO date ("2026-06-20") without timezone drift. */
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function monogram(job: Job): string {
  return (job.company ?? job.title).replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "GM";
}

export function JobsBoard({ jobs }: { jobs: Job[] }) {
  const countries = useMemo(
    () => [...new Set(jobs.map((j) => j.country).filter((c): c is string => Boolean(c)))].sort(),
    [jobs]
  );

  const [country, setCountry] = useState<"all" | string>("all");
  const [seniority, setSeniority] = useState<"all" | JobSeniority>("all");
  const [range, setRange] = useState<RangeRelation>("all");
  const [query, setQuery] = useState("");

  // Applies a link like /jobs?country=India&range=lastweek on arrival. Read on
  // mount rather than via a lazy useState initializer (which would read
  // window.location during the SSR-matching first client render too, ahead of
  // this effect, and produce the same result — but a plain effect keeps the
  // server- and client-rendered markup identical, avoiding a hydration
  // mismatch) — see OnboardingHydrator for the same tradeoff.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawCountry = params.get("country");
    const matchedCountry = countries.find((c) => c.toLowerCase() === rawCountry?.toLowerCase());
    if (matchedCountry) setCountry(matchedCountry);
    const rawSeniority = params.get("seniority");
    if (SENIORITY_FILTERS.some((f) => f.value === rawSeniority)) setSeniority(rawSeniority as JobSeniority);
    const rawRange = params.get("range");
    if (RANGE_FILTERS.some((f) => f.value === rawRange)) setRange(rawRange as RangeRelation);
    const rawQuery = params.get("q");
    if (rawQuery) setQuery(rawQuery);
  }, [countries]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      jobs.filter((j) => {
        if (country !== "all" && j.country !== country) return false;
        if (seniority !== "all" && j.seniority !== seniority) return false;
        if (!matchesRange(j, range)) return false;
        if (!q) return true;
        return (
          j.title.toLowerCase().includes(q) ||
          (j.company ?? "").toLowerCase().includes(q) ||
          (j.location ?? "").toLowerCase().includes(q) ||
          j.tags.some((t) => t.toLowerCase().includes(q))
        );
      }),
    [jobs, country, seniority, range, q]
  );

  // Keep the URL in sync so the current filtered view stays shareable. Plain
  // history.replaceState (see share-cards/studio.tsx) rather than the Next
  // router, which would re-run the page's server fetch on every keystroke.
  // Skips its first run so it can't race the mount effect above and briefly
  // clobber a deep link before that effect's state update lands.
  const skipFirstSync = useRef(true);
  useEffect(() => {
    if (skipFirstSync.current) {
      skipFirstSync.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (country !== "all") params.set("country", country);
    if (seniority !== "all") params.set("seniority", seniority);
    if (range !== "all") params.set("range", range);
    if (query.trim()) params.set("q", query.trim());
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [country, seniority, range, query]);

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <MagnifyingGlass
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search role, company, skill…"
            className="w-full rounded-pill border border-gray-200 bg-white py-2 pl-9 pr-3 text-[13px] text-ink placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="rounded-pill border border-gray-200 bg-white px-3.5 py-2 text-[12.5px] font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Seniority + posted-date pills */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto">
          {SENIORITY_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setSeniority(f.value)}
              className={
                seniority === f.value
                  ? "shrink-0 rounded-pill bg-teal-900 px-3.5 py-1.5 text-[12.5px] font-semibold text-white"
                  : "shrink-0 rounded-pill border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-gray-700 hover:bg-gray-50"
              }
            >
              {f.label}
            </button>
          ))}
          <span className="mx-0.5 shrink-0 self-center text-gray-200">|</span>
          {RANGE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setRange(f.value)}
              className={
                range === f.value
                  ? "shrink-0 rounded-pill bg-teal-900 px-3.5 py-1.5 text-[12.5px] font-semibold text-white"
                  : "shrink-0 rounded-pill border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-gray-700 hover:bg-gray-50"
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="shrink-0 self-center text-[12px] font-medium text-gray-500">
          {shown.length} role{shown.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Cards */}
      {shown.length === 0 ? (
        <Card className="p-6 text-[13.5px] text-gray-600">
          No roles match your filters. Try clearing the search or picking a different country.
        </Card>
      ) : (
        <div className="space-y-4">
          {shown.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const applyHref = job.applyUrl ?? (job.applyEmail ? `mailto:${job.applyEmail}` : null);
  const meta = [job.location, job.experience].filter(Boolean);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-900 text-[13px] font-bold text-green-500">
          {monogram(job)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-semibold tracking-tight text-ink">
              <Link href={jobHref(job)} className="transition-colors hover:text-teal-700">
                {job.title}
              </Link>
            </h2>
            <Chip tone="neutral">{job.employmentType}</Chip>
          </div>
          {job.company && <div className="mt-0.5 text-[13px] text-gray-700">{job.company}</div>}
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-medium text-gray-600">
            {meta.map((m, i) => (
              <span key={i} className="flex items-center gap-1">
                {i === 0 ? <MapPin size={13} /> : <Clock size={13} />} {m}
              </span>
            ))}
            {job.postedOn && (
              <span className="flex items-center gap-1">
                <CalendarBlank size={13} /> {fmtDate(job.postedOn)}
              </span>
            )}
          </div>
          {job.details && <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed text-gray-600">{job.details}</p>}
          {job.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-pill bg-green-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-green-700"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex w-full shrink-0 flex-col items-start gap-2 sm:w-auto sm:items-end">
          {job.salary && <div className="text-[12.5px] font-semibold text-teal-800">{job.salary}</div>}
          <div className="flex items-center gap-2">
            {applyHref ? (
              <a
                href={applyHref}
                target={job.applyUrl ? "_blank" : undefined}
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-pill bg-teal-900 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-teal-800"
              >
                Apply <ArrowSquareOut size={13} />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-gray-200 px-4 py-2 text-[12.5px] font-medium text-gray-400">
                <Briefcase size={13} /> No link
              </span>
            )}
            <ShareButton path={jobHref(job)} title={job.title} />
          </div>
        </div>
      </div>
    </Card>
  );
}
