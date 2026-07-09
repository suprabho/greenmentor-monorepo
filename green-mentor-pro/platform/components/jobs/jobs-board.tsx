"use client";

import { useMemo, useState } from "react";
import {
  MapPin,
  Briefcase,
  Clock,
  CalendarBlank,
  ArrowSquareOut,
  MagnifyingGlass,
} from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import type { Job, JobSeniority } from "@/lib/jobs/repo";

const SENIORITY_FILTERS: { value: "all" | JobSeniority; label: string }[] = [
  { value: "all", label: "All levels" },
  { value: "entry", label: "Entry" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  const [country, setCountry] = useState<"all" | string>("all");
  const [seniority, setSeniority] = useState<"all" | JobSeniority>("all");
  const [query, setQuery] = useState("");

  const countries = useMemo(
    () => [...new Set(jobs.map((j) => j.country).filter((c): c is string => Boolean(c)))].sort(),
    [jobs]
  );

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      jobs.filter((j) => {
        if (country !== "all" && j.country !== country) return false;
        if (seniority !== "all" && j.seniority !== seniority) return false;
        if (!q) return true;
        return (
          j.title.toLowerCase().includes(q) ||
          (j.company ?? "").toLowerCase().includes(q) ||
          (j.location ?? "").toLowerCase().includes(q) ||
          j.tags.some((t) => t.toLowerCase().includes(q))
        );
      }),
    [jobs, country, seniority, q]
  );

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

      {/* Seniority pills */}
      <div className="mb-5 flex flex-wrap gap-2">
        {SENIORITY_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setSeniority(f.value)}
            className={
              seniority === f.value
                ? "rounded-pill bg-teal-900 px-3.5 py-1.5 text-[12.5px] font-semibold text-white"
                : "rounded-pill border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-gray-700 hover:bg-gray-50"
            }
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto self-center text-[12px] font-medium text-gray-500">
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
            <h2 className="text-[16px] font-semibold tracking-tight text-ink">{job.title}</h2>
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
        </div>
      </div>
    </Card>
  );
}
