"use client";

/**
 * Jobs CMS — create, edit and remove ESG & sustainability job postings. Same
 * shell as the Instructors/Webinars panels (search + status tabs + inline
 * create + per-row editor). Published rows surface on the learner platform's
 * /jobs board through the jobs_public view.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowSquareOut, Briefcase, Plus } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, Stat } from "@/components/ui";
import type { JobRow, JobSeniority, JobStatus } from "@/lib/db/jobs";

type Toast = { type: "idle" | "ok" | "err" | "info"; msg?: string };

const inputCls =
  "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-ink placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500";
const labelCls = "flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500";

const SENIORITY_OPTIONS: { value: "" | JobSeniority; label: string }[] = [
  { value: "", label: "—" },
  { value: "entry", label: "Entry" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
];

const STATUS_OPTIONS: JobStatus[] = ["draft", "published", "archived"];
const STATUS_TABS: ("all" | JobStatus)[] = ["all", "published", "draft", "archived"];
const statusTone: Record<JobStatus, "green" | "neutral" | "warn"> = {
  published: "green",
  draft: "neutral",
  archived: "warn",
};

interface FormState {
  title: string;
  company: string;
  location: string;
  country: string;
  employmentType: string;
  experience: string;
  seniority: "" | JobSeniority;
  details: string;
  tags: string;
  applyUrl: string;
  applyEmail: string;
  salary: string;
  applicationDeadline: string;
  preferred: string;
  postedOn: string;
  notes: string;
  status: JobStatus;
}

const EMPTY_FORM: FormState = {
  title: "",
  company: "",
  location: "",
  country: "",
  employmentType: "Full-time",
  experience: "",
  seniority: "",
  details: "",
  tags: "",
  applyUrl: "",
  applyEmail: "",
  salary: "",
  applicationDeadline: "",
  preferred: "",
  postedOn: "",
  notes: "",
  status: "draft",
};

function toForm(j: JobRow): FormState {
  return {
    title: j.title,
    company: j.company ?? "",
    location: j.location ?? "",
    country: j.country ?? "",
    employmentType: j.employment_type ?? "Full-time",
    experience: j.experience ?? "",
    seniority: j.seniority ?? "",
    details: j.details ?? "",
    tags: j.tags.join(", "),
    applyUrl: j.apply_url ?? "",
    applyEmail: j.apply_email ?? "",
    salary: j.salary ?? "",
    applicationDeadline: j.application_deadline ?? "",
    preferred: j.preferred ?? "",
    postedOn: j.posted_on ?? "",
    notes: j.notes ?? "",
    status: j.status,
  };
}

function toPayload(f: FormState) {
  const s = (v: string) => v.trim() || null;
  return {
    title: f.title.trim(),
    company: s(f.company),
    location: s(f.location),
    country: s(f.country),
    employment_type: f.employmentType.trim() || "Full-time",
    experience: s(f.experience),
    seniority: f.seniority || null,
    details: s(f.details),
    tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
    apply_url: s(f.applyUrl),
    apply_email: s(f.applyEmail),
    salary: s(f.salary),
    application_deadline: s(f.applicationDeadline),
    preferred: s(f.preferred),
    posted_on: s(f.postedOn),
    notes: s(f.notes),
    status: f.status,
  };
}

/** Merge a saved payload back onto a row, so local state matches the DB. */
function applyPayload(row: JobRow, p: ReturnType<typeof toPayload>): JobRow {
  return {
    ...row,
    title: p.title,
    company: p.company,
    location: p.location,
    country: p.country,
    employment_type: p.employment_type,
    experience: p.experience,
    seniority: p.seniority,
    details: p.details,
    tags: p.tags,
    apply_url: p.apply_url,
    apply_email: p.apply_email,
    salary: p.salary,
    application_deadline: p.application_deadline,
    preferred: p.preferred,
    posted_on: p.posted_on,
    notes: p.notes,
    status: p.status,
  };
}

/** All editable fields, shared by the create + edit forms. */
function JobForm({ value, onChange }: { value: FormState; onChange: (patch: Partial<FormState>) => void }) {
  return (
    <>
      <label className={`${labelCls} lg:col-span-2`}>
        Title
        <input
          value={value.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Sustainability & CSR Manager"
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        Company
        <input value={value.company} onChange={(e) => onChange({ company: e.target.value })} className={inputCls} />
      </label>
      <label className={labelCls}>
        Location
        <input
          value={value.location}
          onChange={(e) => onChange({ location: e.target.value })}
          placeholder="e.g. Pune, India"
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        Country
        <input
          value={value.country}
          onChange={(e) => onChange({ country: e.target.value })}
          placeholder="India, UAE, …"
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        Employment type
        <input
          value={value.employmentType}
          onChange={(e) => onChange({ employmentType: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        Experience
        <input
          value={value.experience}
          onChange={(e) => onChange({ experience: e.target.value })}
          placeholder="e.g. 3–5 years"
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        Seniority
        <select
          value={value.seniority}
          onChange={(e) => onChange({ seniority: e.target.value as "" | JobSeniority })}
          className={inputCls}
        >
          {SENIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className={labelCls}>
        Status
        <select
          value={value.status}
          onChange={(e) => onChange({ status: e.target.value as JobStatus })}
          className={inputCls}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
      <label className={`${labelCls} lg:col-span-3`}>
        Details
        <textarea
          value={value.details}
          onChange={(e) => onChange({ details: e.target.value })}
          rows={2}
          placeholder="Responsibilities and key skills"
          className={inputCls}
        />
      </label>
      <label className={`${labelCls} lg:col-span-3`}>
        Tags
        <input
          value={value.tags}
          onChange={(e) => onChange({ tags: e.target.value })}
          placeholder="Comma-separated, e.g. BRSR, GHG Accounting, LEED"
          className={inputCls}
        />
      </label>
      <label className={`${labelCls} lg:col-span-2`}>
        Apply URL
        <input
          value={value.applyUrl}
          onChange={(e) => onChange({ applyUrl: e.target.value })}
          placeholder="https://…"
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        Apply email
        <input
          value={value.applyEmail}
          onChange={(e) => onChange({ applyEmail: e.target.value })}
          placeholder="careers@company.com"
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        Salary
        <input value={value.salary} onChange={(e) => onChange({ salary: e.target.value })} className={inputCls} />
      </label>
      <label className={labelCls}>
        Posted on
        <input
          type="date"
          value={value.postedOn}
          onChange={(e) => onChange({ postedOn: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        Application deadline
        <input
          type="date"
          value={value.applicationDeadline}
          onChange={(e) => onChange({ applicationDeadline: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className={`${labelCls} lg:col-span-3`}>
        Preferred (optional)
        <input value={value.preferred} onChange={(e) => onChange({ preferred: e.target.value })} className={inputCls} />
      </label>
      <label className={`${labelCls} lg:col-span-3`}>
        Notes (admin-only)
        <textarea
          value={value.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={2}
          className={inputCls}
        />
      </label>
    </>
  );
}

export function JobsPanel({ initialJobs, configured }: { initialJobs: JobRow[]; configured: boolean }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobRow[]>(initialJobs);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | JobStatus>("all");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>({ type: "idle" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<FormState | null>(null);

  const counts = useMemo(() => {
    const c = { total: jobs.length, published: 0, draft: 0, archived: 0 } as Record<string, number>;
    for (const j of jobs) c[j.status] = (c[j.status] ?? 0) + 1;
    return c;
  }, [jobs]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      jobs.filter((j) => {
        if (statusFilter !== "all" && j.status !== statusFilter) return false;
        if (!q) return true;
        return (
          j.title.toLowerCase().includes(q) ||
          (j.company ?? "").toLowerCase().includes(q) ||
          (j.location ?? "").toLowerCase().includes(q) ||
          (j.country ?? "").toLowerCase().includes(q) ||
          j.tags.some((t) => t.toLowerCase().includes(q))
        );
      }),
    [jobs, statusFilter, q]
  );

  const closeForm = () => {
    setAdding(false);
    setForm(EMPTY_FORM);
  };

  const create = async () => {
    setSaving(true);
    setToast({ type: "idle" });
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.mode === "unconfigured") {
        setToast({ type: "info", msg: "Creating jobs needs SUPABASE_SERVICE_ROLE_KEY set server-side." });
        return;
      }
      setJobs((prev) => [body.job as JobRow, ...prev]);
      closeForm();
      router.refresh();
    } catch (err) {
      setToast({ type: "err", msg: err instanceof Error ? err.message : "Could not create job" });
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (id: string) => {
    if (!edit) return;
    if (!edit.title.trim()) {
      setToast({ type: "err", msg: "Title is required." });
      return;
    }
    setBusyId(id);
    try {
      const payload = toPayload(edit);
      const res = await fetch(`/api/jobs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ type: "err", msg: body.error ?? `HTTP ${res.status}` });
        return;
      }
      setJobs((prev) => prev.map((j) => (j.id === id ? applyPayload(j, payload) : j)));
      setEditingId(null);
      setEdit(null);
      setToast({ type: "ok", msg: `Saved "${payload.title}".` });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This removes it from the platform jobs board.`)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      if (res.ok) setJobs((prev) => prev.filter((j) => j.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      {!configured ? (
        <p className="mb-4 rounded-lg bg-[#FFF4E0] px-3 py-2 text-[12px] text-[#B25E00]">
          Jobs needs SUPABASE_SERVICE_ROLE_KEY set server-side — shown empty until then.
        </p>
      ) : null}

      {toast.type !== "idle" ? (
        <div
          className={`mb-4 rounded-lg px-3 py-2 text-[12px] ${
            toast.type === "err"
              ? "bg-red-50 text-danger"
              : toast.type === "info"
                ? "bg-[#FFF4E0] text-[#B25E00]"
                : "bg-green-50 text-green-700"
          }`}
        >
          {toast.msg}
        </div>
      ) : null}

      <Card className="mb-4 grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Stat label="Total" value={String(counts.total)} />
        <Stat label="Published" value={String(counts.published)} tone="ok" />
        <Stat label="Drafts" value={String(counts.draft)} />
        <Stat label="Archived" value={String(counts.archived)} />
      </Card>

      <Card>
        {adding ? (
          <form
            className="grid gap-3 border-b border-gray-100 p-5 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (form.title.trim()) void create();
            }}
          >
            <JobForm value={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
            <div className="flex items-center gap-3 lg:col-span-3">
              <button
                type="submit"
                disabled={saving || !form.title.trim()}
                className="rounded-pill bg-teal-900 px-4 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-40"
              >
                {saving ? "Adding…" : "Add job"}
              </button>
              <button type="button" onClick={closeForm} className="text-[12px] font-medium text-gray-500 hover:text-ink">
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5 pb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={
                  statusFilter === tab
                    ? "rounded-pill bg-teal-900 px-3 py-1 text-[12px] font-semibold capitalize text-white"
                    : "rounded-pill border border-gray-200 bg-white px-3 py-1 text-[12px] font-medium capitalize text-gray-600 hover:bg-gray-50"
                }
              >
                {tab}
                {tab !== "all" ? ` · ${counts[tab] ?? 0}` : ` · ${counts.total}`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, company, country, tag…"
              className={`${inputCls} w-56`}
            />
            {!adding && (
              <button
                type="button"
                onClick={() => {
                  setAdding(true);
                  setToast({ type: "idle" });
                }}
                className="inline-flex items-center gap-1 rounded-pill bg-teal-900 px-3 py-1 text-[12px] font-medium text-white transition-colors hover:bg-teal-800"
              >
                <Plus size={12} weight="bold" /> New job
              </button>
            )}
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="p-5 text-[13px] text-gray-500">
            {jobs.length === 0
              ? "No jobs yet — add the first one above."
              : `No jobs match this filter${query.trim() ? ` / "${query.trim()}"` : ""}.`}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {shown.map((j) => (
              <li key={j.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-900 text-[12px] font-bold text-green-500">
                      {(j.company ?? j.title).slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold text-ink">{j.title}</span>
                        <Chip tone={statusTone[j.status]}>{j.status}</Chip>
                        {j.apply_url ? (
                          <a
                            href={j.apply_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-gray-500 hover:text-ink"
                          >
                            Apply link <ArrowSquareOut size={11} />
                          </a>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-[12px] text-gray-500">
                        {[j.company, j.location].filter(Boolean).join(" · ") || "—"}
                        {j.experience ? ` · ${j.experience}` : ""}
                      </div>
                      {j.tags.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {j.tags.map((t) => (
                            <Chip key={t} tone="teal">
                              {t}
                            </Chip>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (editingId === j.id) {
                          setEditingId(null);
                          setEdit(null);
                        } else {
                          setEditingId(j.id);
                          setEdit(toForm(j));
                          setToast({ type: "idle" });
                        }
                      }}
                      disabled={busyId === j.id}
                      className="rounded-pill border border-gray-200 px-2.5 py-1 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                    >
                      {editingId === j.id ? "Close" : "Edit"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(j.id, j.title)}
                      disabled={busyId === j.id}
                      className="rounded-pill border border-red-200 px-2.5 py-1 text-[12px] font-medium text-danger transition-colors hover:bg-red-50 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {editingId === j.id && edit ? (
                  <form
                    className="mt-4 grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveEdit(j.id);
                    }}
                  >
                    <JobForm value={edit} onChange={(patch) => setEdit((s) => s && { ...s, ...patch })} />
                    <div className="flex items-center gap-3 lg:col-span-3">
                      <button
                        type="submit"
                        disabled={busyId === j.id}
                        className="rounded-pill bg-teal-900 px-4 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-40"
                      >
                        {busyId === j.id ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEdit(null);
                        }}
                        className="text-[12px] font-medium text-gray-500 hover:text-ink"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
