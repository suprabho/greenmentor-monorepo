"use client";

/**
 * Webinars tab: the Academy's webinar tracker, replacing the FY 26-27
 * spreadsheet. Same shape as the Stories panel (status tabs + search +
 * inline create + status transitions), extended with a totals strip and a
 * per-row expanding editor for scheduling fields and the post-webinar
 * funnel metrics. Derived rates (attendance %, conversion %) are computed
 * here, never stored.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowSquareOut, Plus, Sparkle, X } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, Stat } from "@/components/ui";
import { WebinarPollsEditor } from "@/components/webinars/webinar-polls-editor";
import type { WebinarRow, WebinarStatus } from "@/lib/db/webinars";
import type { InstructorRow } from "@/lib/db/instructors";

const STATUS_OPTIONS: { key: WebinarStatus; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "published", label: "Published" },
  { key: "completed", label: "Completed" },
  { key: "archived", label: "Archived" },
];

const TABS: { key: "all" | WebinarStatus; label: string }[] = [
  { key: "all", label: "All" },
  ...STATUS_OPTIONS,
];

const STATUS_TONE: Record<WebinarStatus, "neutral" | "green" | "teal" | "warn" | "danger"> = {
  draft: "neutral",
  published: "green",
  completed: "teal",
  archived: "warn",
};

type Status = { type: "idle" | "ok" | "err" | "info"; msg?: string };

const inputCls =
  "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-ink placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500";
const labelCls = "flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500";

const METRIC_INPUTS: { key: MetricKey; label: string }[] = [
  { key: "registrations", label: "Registrations" },
  { key: "attendees", label: "Attendees" },
  { key: "interest_shown", label: "Interest shown" },
  { key: "unique_attendees", label: "Unique attendees" },
  { key: "sales_calls_booked", label: "Sales calls" },
  { key: "buyers", label: "Buyers" },
  { key: "avg_ticket_inr", label: "Avg ticket ₹" },
  { key: "revenue_inr", label: "Revenue ₹" },
];

type MetricKey =
  | "registrations"
  | "attendees"
  | "interest_shown"
  | "unique_attendees"
  | "sales_calls_booked"
  | "buyers"
  | "avg_ticket_inr"
  | "revenue_inr";

function fmtDateTime(iso: string | null): string {
  if (!iso) return "Unscheduled";
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function fmtInr(value: number | null): string {
  if (value == null) return "—";
  return `₹${value.toLocaleString("en-IN")}`;
}

function pct(num: number | null, den: number | null): string {
  if (num == null || den == null || den === 0) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}

/** ISO timestamptz → value for a `datetime-local` input, in the browser's zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

/** Multi-select of instructors from the roster, stored as an ordered id list. */
function InstructorPicker({
  value,
  onChange,
  roster,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  roster: InstructorRow[];
}) {
  const byId = useMemo(() => Object.fromEntries(roster.map((r) => [r.id, r])), [roster]);
  const available = roster.filter((r) => !value.includes(r.id));
  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-pill bg-teal-50 px-2.5 py-1 text-[12px] font-medium text-teal-900"
            >
              {byId[id]?.name ?? "Unknown instructor"}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== id))}
                className="text-teal-700 hover:text-teal-900"
                aria-label="Remove instructor"
              >
                <X size={12} weight="bold" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) onChange([...value, e.target.value]);
        }}
        disabled={available.length === 0 && roster.length > 0}
        className={inputCls}
      >
        <option value="">
          {roster.length === 0
            ? "No instructors yet — add them in the Instructors section"
            : available.length === 0
              ? "All instructors selected"
              : "Add instructor…"}
        </option>
        {available.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
            {r.company ? ` — ${r.company}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

interface EditState {
  title: string;
  hook: string;
  instructorIds: string[];
  scheduledAt: string; // datetime-local value
  durationMinutes: string;
  registrationUrl: string;
  creativesUrl: string;
  zoomMeetingNumber: string;
  zoomPasscode: string;
  notes: string;
  metrics: Record<MetricKey, string>;
}

function toEditState(w: WebinarRow): EditState {
  const metrics = {} as Record<MetricKey, string>;
  for (const { key } of METRIC_INPUTS) metrics[key] = w[key] == null ? "" : String(w[key]);
  return {
    title: w.title,
    hook: w.hook ?? "",
    instructorIds: w.instructor_ids,
    scheduledAt: toLocalInput(w.scheduled_at),
    durationMinutes: w.duration_minutes == null ? "" : String(w.duration_minutes),
    registrationUrl: w.registration_url ?? "",
    creativesUrl: w.creatives_url ?? "",
    zoomMeetingNumber: w.zoom_meeting_number ?? "",
    zoomPasscode: w.zoom_passcode ?? "",
    notes: w.notes ?? "",
    metrics,
  };
}

export function WebinarsPanel({
  initialWebinars,
  initialRsvpCounts,
  instructors,
  configured,
}: {
  initialWebinars: WebinarRow[];
  initialRsvpCounts: Record<string, number>;
  instructors: InstructorRow[];
  configured: boolean;
}) {
  const router = useRouter();
  const [webinars, setWebinars] = useState<WebinarRow[]>(initialWebinars);
  const [rsvpCounts] = useState<Record<string, number>>(initialRsvpCounts);
  const instructorsById = useMemo(
    () => Object.fromEntries(instructors.map((i) => [i.id, i])),
    [instructors]
  );
  const instructorNames = (ids: string[]) =>
    ids.map((id) => instructorsById[id]?.name).filter(Boolean).join(", ");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    hook: string;
    instructorIds: string[];
    scheduledAt: string;
    registrationUrl: string;
  }>({
    title: "",
    hook: "",
    instructorIds: [],
    scheduledAt: "",
    registrationUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: webinars.length };
    for (const w of webinars) c[w.status] = (c[w.status] ?? 0) + 1;
    return c;
  }, [webinars]);

  const totals = useMemo(() => {
    let reg = 0;
    let att = 0;
    let revenue = 0;
    for (const w of webinars) {
      if (w.status === "archived") continue;
      reg += w.registrations ?? 0;
      att += w.attendees ?? 0;
      revenue += w.revenue_inr ?? 0;
    }
    return { reg, att, revenue };
  }, [webinars]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      webinars
        .filter((w) => tab === "all" || w.status === tab)
        .filter(
          (w) =>
            !q ||
            w.title.toLowerCase().includes(q) ||
            (w.hook ?? "").toLowerCase().includes(q) ||
            w.instructor_ids.some((id) => (instructorsById[id]?.name ?? "").toLowerCase().includes(q))
        )
        .sort((a, b) => (b.scheduled_at ?? "9999").localeCompare(a.scheduled_at ?? "9999")),
    [webinars, tab, q, instructorsById]
  );

  const closeForm = () => {
    setAdding(false);
    setForm({ title: "", hook: "", instructorIds: [], scheduledAt: "", registrationUrl: "" });
  };

  const create = async () => {
    setSaving(true);
    setStatus({ type: "idle" });
    try {
      const res = await fetch("/api/webinars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          hook: form.hook.trim() || null,
          instructor_ids: form.instructorIds,
          scheduled_at: fromLocalInput(form.scheduledAt),
          registration_url: form.registrationUrl.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.mode === "unconfigured") {
        setStatus({
          type: "info",
          msg: "Creating webinars needs SUPABASE_SERVICE_ROLE_KEY set server-side.",
        });
        return;
      }
      setWebinars((prev) => [body.webinar as WebinarRow, ...prev]);
      setTab("draft");
      closeForm();
      router.refresh();
    } catch (err) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Could not create webinar" });
    } finally {
      setSaving(false);
    }
  };

  const patch = async (id: string, payload: Record<string, unknown>): Promise<boolean> => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/webinars/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ type: "err", msg: body.error ?? `HTTP ${res.status}` });
        return false;
      }
      return true;
    } finally {
      setUpdating(null);
    }
  };

  const updateStatus = async (id: string, next: WebinarStatus) => {
    if (await patch(id, { status: next })) {
      setWebinars((prev) => prev.map((w) => (w.id === id ? { ...w, status: next } : w)));
      router.refresh();
    }
  };

  const openEditor = (w: WebinarRow) => {
    setEditingId(w.id);
    setEdit(toEditState(w));
    setStatus({ type: "idle" });
  };

  const saveEdit = async (w: WebinarRow) => {
    if (!edit) return;
    const metricPayload: Record<string, number | null> = {};
    for (const { key } of METRIC_INPUTS) {
      const raw = edit.metrics[key].trim();
      if (raw === "") {
        metricPayload[key] = null;
        continue;
      }
      const n = Number(raw.replace(/[₹,\s]/g, ""));
      if (!Number.isInteger(n) || n < 0) {
        setStatus({ type: "err", msg: `${key.replaceAll("_", " ")} must be a whole non-negative number` });
        return;
      }
      metricPayload[key] = n;
    }
    const payload = {
      title: edit.title.trim() || w.title,
      hook: edit.hook.trim() || null,
      instructor_ids: edit.instructorIds,
      scheduled_at: fromLocalInput(edit.scheduledAt),
      duration_minutes: edit.durationMinutes.trim() === "" ? null : Number(edit.durationMinutes),
      registration_url: edit.registrationUrl.trim() || null,
      creatives_url: edit.creativesUrl.trim() || null,
      zoom_meeting_number: edit.zoomMeetingNumber.trim() || null,
      zoom_passcode: edit.zoomPasscode.trim() || null,
      notes: edit.notes.trim() || null,
      ...metricPayload,
    };
    if (payload.duration_minutes != null && (!Number.isInteger(payload.duration_minutes) || payload.duration_minutes < 0)) {
      setStatus({ type: "err", msg: "duration must be a whole non-negative number of minutes" });
      return;
    }
    if (await patch(w.id, payload)) {
      setWebinars((prev) => prev.map((row) => (row.id === w.id ? { ...row, ...(payload as Partial<WebinarRow>) } : row)));
      setEditingId(null);
      setEdit(null);
      setStatus({ type: "ok", msg: `Saved "${payload.title}".` });
      router.refresh();
    }
  };

  const remove = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}" permanently? RSVPs go with it.`)) return;
    setUpdating(id);
    try {
      const res = await fetch(`/api/webinars/${id}`, { method: "DELETE" });
      if (res.ok) setWebinars((prev) => prev.filter((w) => w.id !== id));
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div>
      {!configured ? (
        <p className="mb-4 rounded-lg bg-[#FFF4E0] px-3 py-2 text-[12px] text-[#B25E00]">
          Webinars needs SUPABASE_SERVICE_ROLE_KEY set server-side — shown empty until then.
        </p>
      ) : null}

      {status.type !== "idle" ? (
        <div
          className={`mb-4 rounded-lg px-3 py-2 text-[12px] ${
            status.type === "err"
              ? "bg-red-50 text-danger"
              : status.type === "info"
                ? "bg-[#FFF4E0] text-[#B25E00]"
                : "bg-green-50 text-green-700"
          }`}
        >
          {status.msg}
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Registrations" value={totals.reg.toLocaleString("en-IN")} sub="all tracked webinars" />
        <Stat label="Attendees" value={totals.att.toLocaleString("en-IN")} />
        <Stat
          label="Attendance"
          value={pct(totals.att, totals.reg)}
          tone={totals.reg > 0 && totals.att / totals.reg >= 0.65 ? "ok" : "default"}
          sub="target 65%"
        />
        <Stat label="Revenue" value={fmtInr(totals.revenue)} />
      </div>

      <Card>
        {adding ? (
          <form
            className="flex flex-wrap items-end gap-3 border-b border-gray-100 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (form.title.trim()) void create();
            }}
          >
            <label className={`${labelCls} min-w-44 flex-1`}>
              Title
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. GHG Lead Verifier #2"
                className={inputCls}
              />
            </label>
            <label className={`${labelCls} min-w-56 flex-1`}>
              Hook
              <input
                value={form.hook}
                onChange={(e) => setForm((f) => ({ ...f, hook: e.target.value }))}
                placeholder="Marketing headline learners see"
                className={inputCls}
              />
            </label>
            <label className={`${labelCls} min-w-56 flex-1`}>
              Instructors
              <InstructorPicker
                value={form.instructorIds}
                onChange={(ids) => setForm((f) => ({ ...f, instructorIds: ids }))}
                roster={instructors}
              />
            </label>
            <label className={labelCls}>
              When
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              Registration URL
              <input
                value={form.registrationUrl}
                onChange={(e) => setForm((f) => ({ ...f, registrationUrl: e.target.value }))}
                placeholder="https://…"
                className={inputCls}
              />
            </label>
            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="rounded-pill bg-teal-900 px-4 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-40"
            >
              {saving ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="text-[12px] font-medium text-gray-500 hover:text-ink"
            >
              Cancel
            </button>
          </form>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5 pb-4">
          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`shrink-0 rounded-pill px-3 py-1 text-[12px] font-medium transition-colors ${
                  tab === t.key ? "bg-teal-900 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-ink"
                }`}
              >
                {t.label}{" "}
                <span className={tab === t.key ? "opacity-70" : "text-gray-400"}>{counts[t.key] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, hook, instructor…"
              className={`${inputCls} w-56`}
            />
            {!adding && (
              <button
                type="button"
                onClick={() => {
                  setAdding(true);
                  setStatus({ type: "idle" });
                }}
                className="inline-flex items-center gap-1 rounded-pill bg-teal-900 px-3 py-1 text-[12px] font-medium text-white transition-colors hover:bg-teal-800"
              >
                <Plus size={12} weight="bold" /> New webinar
              </button>
            )}
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="p-5 text-[13px] text-gray-500">
            {webinars.length === 0
              ? "No webinars yet — add the first one above."
              : q
                ? `No ${tab === "all" ? "" : `${tab} `}webinars match "${query.trim()}".`
                : `No ${tab === "all" ? "" : `${tab} `}webinars.`}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {shown.map((w) => (
              <li key={w.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-ink">{w.title}</span>
                      <Chip tone={STATUS_TONE[w.status]}>{w.status}</Chip>
                      {(rsvpCounts[w.id] ?? 0) > 0 ? (
                        <Chip tone="teal">{rsvpCounts[w.id]} RSVP{rsvpCounts[w.id] === 1 ? "" : "s"}</Chip>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[12px] text-gray-500">
                      {fmtDateTime(w.scheduled_at)}
                      {w.instructor_ids.length > 0 ? ` · ${instructorNames(w.instructor_ids)}` : ""}
                      {w.hook ? ` · ${w.hook}` : ""}
                    </div>
                    {w.registrations != null || w.attendees != null || w.revenue_inr != null ? (
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-gray-600">
                        <span>Reg {w.registrations ?? "—"}</span>
                        <span>Att {w.attendees ?? "—"}</span>
                        <span>Att% {pct(w.attendees, w.registrations)}</span>
                        <span>Calls {w.sales_calls_booked ?? "—"}</span>
                        <span>Buyers {w.buyers ?? "—"}</span>
                        <span>Revenue {fmtInr(w.revenue_inr)}</span>
                        <span>Conv% {pct(w.buyers, w.unique_attendees)}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {w.creatives_url ? (
                      <a
                        href={w.creatives_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-pill border border-gray-200 px-2.5 py-1 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
                      >
                        Creatives <ArrowSquareOut size={12} />
                      </a>
                    ) : null}
                    <select
                      value={w.status}
                      onChange={(e) => void updateStatus(w.id, e.target.value as WebinarStatus)}
                      disabled={updating === w.id}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-700 disabled:opacity-50"
                    >
                      {STATUS_OPTIONS.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => (editingId === w.id ? setEditingId(null) : openEditor(w))}
                      disabled={updating === w.id}
                      className="rounded-pill border border-gray-200 px-2.5 py-1 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                    >
                      {editingId === w.id ? "Close" : "Edit"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(w.id, w.title)}
                      disabled={updating === w.id}
                      className="rounded-pill border border-red-200 px-2.5 py-1 text-[12px] font-medium text-danger transition-colors hover:bg-red-50 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {editingId === w.id && edit ? (
                  <form
                    className="mt-4 rounded-xl bg-gray-50 p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveEdit(w);
                    }}
                  >
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <label className={labelCls}>
                        Title
                        <input
                          value={edit.title}
                          onChange={(e) => setEdit((s) => s && { ...s, title: e.target.value })}
                          className={inputCls}
                        />
                      </label>
                      <label className={`${labelCls} lg:col-span-2`}>
                        Hook
                        <input
                          value={edit.hook}
                          onChange={(e) => setEdit((s) => s && { ...s, hook: e.target.value })}
                          className={inputCls}
                        />
                      </label>
                      <label className={labelCls}>
                        Instructors
                        <InstructorPicker
                          value={edit.instructorIds}
                          onChange={(ids) => setEdit((s) => s && { ...s, instructorIds: ids })}
                          roster={instructors}
                        />
                      </label>
                      <label className={labelCls}>
                        When
                        <input
                          type="datetime-local"
                          value={edit.scheduledAt}
                          onChange={(e) => setEdit((s) => s && { ...s, scheduledAt: e.target.value })}
                          className={inputCls}
                        />
                      </label>
                      <label className={labelCls}>
                        Duration (min)
                        <input
                          inputMode="numeric"
                          value={edit.durationMinutes}
                          onChange={(e) => setEdit((s) => s && { ...s, durationMinutes: e.target.value })}
                          className={inputCls}
                        />
                      </label>
                      <label className={labelCls}>
                        Registration URL
                        <input
                          value={edit.registrationUrl}
                          onChange={(e) => setEdit((s) => s && { ...s, registrationUrl: e.target.value })}
                          className={inputCls}
                        />
                      </label>
                      <label className={labelCls}>
                        Creatives URL
                        <input
                          value={edit.creativesUrl}
                          onChange={(e) => setEdit((s) => s && { ...s, creativesUrl: e.target.value })}
                          className={inputCls}
                        />
                      </label>
                      <label className={labelCls}>
                        Zoom meeting number
                        <input
                          inputMode="numeric"
                          value={edit.zoomMeetingNumber}
                          onChange={(e) => setEdit((s) => s && { ...s, zoomMeetingNumber: e.target.value })}
                          placeholder="e.g. 84512345678"
                          className={inputCls}
                        />
                      </label>
                      <label className={labelCls}>
                        Zoom passcode
                        <input
                          value={edit.zoomPasscode}
                          onChange={(e) => setEdit((s) => s && { ...s, zoomPasscode: e.target.value })}
                          placeholder="Join passcode"
                          className={inputCls}
                        />
                      </label>
                      <label className={labelCls}>
                        Notes
                        <input
                          value={edit.notes}
                          onChange={(e) => setEdit((s) => s && { ...s, notes: e.target.value })}
                          className={inputCls}
                        />
                      </label>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                        Header image
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {w.cover_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={w.cover_image_url}
                            alt=""
                            className="h-14 w-24 rounded-lg border border-gray-200 object-cover"
                          />
                        ) : null}
                        <Link
                          href={`/header-studio?webinar=${w.id}`}
                          className="inline-flex items-center gap-1.5 rounded-pill bg-green-600 px-3.5 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-green-700"
                        >
                          <Sparkle size={13} weight="bold" />
                          {w.cover_image_url ? "Redesign header" : "Design header in Aura Studio"}
                        </Link>
                        <span className="text-[11.5px] text-gray-500">
                          {w.cover_image_url
                            ? "Cover set — shown on the learner card. Redesign to replace it."
                            : "Opens the Aura Header Studio pre-filled from this webinar; saving links the cover back here."}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                        Post-webinar metrics
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {METRIC_INPUTS.map((m) => (
                          <label key={m.key} className={labelCls}>
                            {m.label}
                            <input
                              inputMode="numeric"
                              value={edit.metrics[m.key]}
                              onChange={(e) =>
                                setEdit((s) => s && { ...s, metrics: { ...s.metrics, [m.key]: e.target.value } })
                              }
                              className={inputCls}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <WebinarPollsEditor webinarId={w.id} />

                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={updating === w.id}
                        className="rounded-pill bg-teal-900 px-4 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-40"
                      >
                        {updating === w.id ? "Saving…" : "Save"}
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
