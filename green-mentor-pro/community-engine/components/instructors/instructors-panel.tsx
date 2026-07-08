"use client";

/**
 * Instructors CMS — create, edit and remove the practitioner roster. Same shell
 * as the Stories/Webinars panels (search + inline create + per-row editor).
 * Profiles here are referenced by webinars (by id) and prefill the Aura header
 * speaker card, so the fields mirror the platform `Mentor` shape.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowSquareOut, Plus } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import { deriveInitials, type InstructorRow } from "@/lib/db/instructors";

type Status = { type: "idle" | "ok" | "err" | "info"; msg?: string };

const inputCls =
  "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-ink placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500";
const labelCls = "flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500";

interface FormState {
  name: string;
  role: string;
  company: string;
  location: string;
  education: string;
  photo: string;
  linkedinUrl: string;
  tags: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  role: "",
  company: "",
  location: "",
  education: "",
  photo: "",
  linkedinUrl: "",
  tags: "",
};

function toForm(i: InstructorRow): FormState {
  return {
    name: i.name,
    role: i.role ?? "",
    company: i.company ?? "",
    location: i.location ?? "",
    education: i.education ?? "",
    photo: i.photo ?? "",
    linkedinUrl: i.linkedin_url ?? "",
    tags: i.tags.join(", "),
  };
}

function toPayload(f: FormState) {
  return {
    name: f.name.trim(),
    role: f.role.trim() || null,
    company: f.company.trim() || null,
    location: f.location.trim() || null,
    education: f.education.trim() || null,
    photo: f.photo.trim() || null,
    linkedin_url: f.linkedinUrl.trim() || null,
    tags: f.tags.split(",").map((s) => s.trim()).filter(Boolean),
    initials: deriveInitials(f.name),
  };
}

function Avatar({ name, photo, initials }: { name: string; photo: string | null; initials: string }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={name} className="size-10 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-teal-900 text-[12px] font-semibold text-white">
      {initials || deriveInitials(name)}
    </span>
  );
}

export function InstructorsPanel({
  initialInstructors,
  configured,
}: {
  initialInstructors: InstructorRow[];
  configured: boolean;
}) {
  const router = useRouter();
  const [instructors, setInstructors] = useState<InstructorRow[]>(initialInstructors);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<FormState | null>(null);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      instructors.filter(
        (i) =>
          !q ||
          i.name.toLowerCase().includes(q) ||
          (i.role ?? "").toLowerCase().includes(q) ||
          (i.company ?? "").toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q))
      ),
    [instructors, q]
  );

  const closeForm = () => {
    setAdding(false);
    setForm(EMPTY_FORM);
  };

  const create = async () => {
    setSaving(true);
    setStatus({ type: "idle" });
    try {
      const res = await fetch("/api/instructors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.mode === "unconfigured") {
        setStatus({ type: "info", msg: "Creating instructors needs SUPABASE_SERVICE_ROLE_KEY set server-side." });
        return;
      }
      setInstructors((prev) =>
        [...prev, body.instructor as InstructorRow].sort((a, b) => a.name.localeCompare(b.name))
      );
      closeForm();
      router.refresh();
    } catch (err) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Could not create instructor" });
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (id: string) => {
    if (!edit) return;
    if (!edit.name.trim()) {
      setStatus({ type: "err", msg: "Name is required." });
      return;
    }
    setBusyId(id);
    try {
      const payload = toPayload(edit);
      const res = await fetch(`/api/instructors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ type: "err", msg: body.error ?? `HTTP ${res.status}` });
        return;
      }
      setInstructors((prev) =>
        prev
          .map((i) =>
            i.id === id
              ? {
                  ...i,
                  name: payload.name,
                  role: payload.role,
                  company: payload.company,
                  location: payload.location,
                  education: payload.education,
                  photo: payload.photo,
                  linkedin_url: payload.linkedin_url,
                  tags: payload.tags,
                  initials: payload.initials,
                }
              : i
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
      setEdit(null);
      setStatus({ type: "ok", msg: `Saved "${payload.name}".` });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? Webinars referencing them will show one fewer instructor.`)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/instructors/${id}`, { method: "DELETE" });
      if (res.ok) setInstructors((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      {!configured ? (
        <p className="mb-4 rounded-lg bg-[#FFF4E0] px-3 py-2 text-[12px] text-[#B25E00]">
          Instructors needs SUPABASE_SERVICE_ROLE_KEY set server-side — shown empty until then.
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

      <Card>
        {adding ? (
          <form
            className="grid gap-3 border-b border-gray-100 p-5 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (form.name.trim()) void create();
            }}
          >
            <label className={labelCls}>
              Name
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Vishal Pandhare"
                className={inputCls}
              />
            </label>
            <label className={`${labelCls} lg:col-span-2`}>
              Role
              <input
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="Current headline / what they do"
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              Company
              <input
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              Location
              <input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              Education
              <input
                value={form.education}
                onChange={(e) => setForm((f) => ({ ...f, education: e.target.value }))}
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              Photo URL
              <input
                value={form.photo}
                onChange={(e) => setForm((f) => ({ ...f, photo: e.target.value }))}
                placeholder="https://… or /mentors/name.jpeg"
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              LinkedIn URL
              <input
                value={form.linkedinUrl}
                onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))}
                className={inputCls}
              />
            </label>
            <label className={`${labelCls} lg:col-span-3`}>
              Tags
              <input
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="Comma-separated, e.g. GHG Accounting, LCA & EPD"
                className={inputCls}
              />
            </label>
            <div className="flex items-center gap-3 lg:col-span-3">
              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="rounded-pill bg-teal-900 px-4 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-40"
              >
                {saving ? "Adding…" : "Add instructor"}
              </button>
              <button type="button" onClick={closeForm} className="text-[12px] font-medium text-gray-500 hover:text-ink">
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5 pb-4">
          <span className="text-[12px] text-gray-500">
            {instructors.length} instructor{instructors.length === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, role, company, tag…"
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
                <Plus size={12} weight="bold" /> New instructor
              </button>
            )}
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="p-5 text-[13px] text-gray-500">
            {instructors.length === 0
              ? "No instructors yet — add the first one above."
              : `No instructors match "${query.trim()}".`}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {shown.map((i) => (
              <li key={i.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={i.name} photo={i.photo} initials={i.initials} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold text-ink">{i.name}</span>
                        {i.linkedin_url ? (
                          <a
                            href={i.linkedin_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-gray-500 hover:text-ink"
                          >
                            LinkedIn <ArrowSquareOut size={11} />
                          </a>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-[12px] text-gray-500">
                        {[i.role, i.company].filter(Boolean).join(" · ") || "—"}
                        {i.location ? ` · ${i.location}` : ""}
                      </div>
                      {i.tags.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {i.tags.map((t) => (
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
                        if (editingId === i.id) {
                          setEditingId(null);
                          setEdit(null);
                        } else {
                          setEditingId(i.id);
                          setEdit(toForm(i));
                          setStatus({ type: "idle" });
                        }
                      }}
                      disabled={busyId === i.id}
                      className="rounded-pill border border-gray-200 px-2.5 py-1 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                    >
                      {editingId === i.id ? "Close" : "Edit"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(i.id, i.name)}
                      disabled={busyId === i.id}
                      className="rounded-pill border border-red-200 px-2.5 py-1 text-[12px] font-medium text-danger transition-colors hover:bg-red-50 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {editingId === i.id && edit ? (
                  <form
                    className="mt-4 grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveEdit(i.id);
                    }}
                  >
                    {(
                      [
                        ["name", "Name"],
                        ["role", "Role"],
                        ["company", "Company"],
                        ["location", "Location"],
                        ["education", "Education"],
                        ["photo", "Photo URL"],
                        ["linkedinUrl", "LinkedIn URL"],
                        ["tags", "Tags (comma-separated)"],
                      ] as [keyof FormState, string][]
                    ).map(([key, label]) => (
                      <label key={key} className={`${labelCls} ${key === "tags" ? "lg:col-span-3" : ""}`}>
                        {label}
                        <input
                          value={edit[key]}
                          onChange={(e) => setEdit((s) => s && { ...s, [key]: e.target.value })}
                          className={inputCls}
                        />
                      </label>
                    ))}
                    <div className="flex items-center gap-3 lg:col-span-3">
                      <button
                        type="submit"
                        disabled={busyId === i.id}
                        className="rounded-pill bg-teal-900 px-4 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-40"
                      >
                        {busyId === i.id ? "Saving…" : "Save"}
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
