"use client";

/**
 * Stories tab: a status-tabbed list of content pieces (webinars, newsletters,
 * posts, social) with search, inline "+ New story" creation, and a status
 * dropdown per row. A light-theme port of vismay's apps/admin StoriesManager /
 * StoriesListClient pattern (tabs + search + status transitions) — GreenMentor
 * Stories aren't markdown-authored data-journalism pieces like vismay's, so
 * the port keeps the admin UX (tabs, search, status control) and drops the
 * markdown upload / drag-to-reorder machinery that was specific to that.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import type { StoryContentType, StoryRow, StoryStatus } from "@/lib/db/stories";

const STATUS_TABS: { key: StoryStatus; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "review", label: "Review" },
  { key: "published", label: "Published" },
  { key: "archived", label: "Archived" },
];

const STATUS_TONE: Record<StoryStatus, "neutral" | "green" | "teal" | "warn" | "danger"> = {
  draft: "neutral",
  review: "warn",
  published: "green",
  archived: "neutral",
};

const CONTENT_TYPE_TONE: Record<StoryContentType, "neutral" | "green" | "teal" | "warn" | "danger"> = {
  webinar: "teal",
  newsletter: "green",
  post: "neutral",
  social: "warn",
};

type Status = { type: "idle" | "ok" | "err" | "info"; msg?: string };

const inputCls =
  "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-ink placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function StoriesPanel({
  initialStories,
  configured,
}: {
  initialStories: StoryRow[];
  configured: boolean;
}) {
  const router = useRouter();
  const [stories, setStories] = useState<StoryRow[]>(initialStories);
  const [tab, setTab] = useState<StoryStatus>("draft");
  const [query, setQuery] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<StoryContentType>("post");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of stories) c[s.status] = (c[s.status] ?? 0) + 1;
    return c;
  }, [stories]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      stories
        .filter((s) => s.status === tab)
        .filter((s) => !q || s.title.toLowerCase().includes(q))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [stories, tab, q]
  );

  const openForm = () => {
    setAdding(true);
    setStatus({ type: "idle" });
  };
  const closeForm = () => {
    setAdding(false);
    setTitle("");
    setTargetDate("");
    setContentType("post");
  };

  const create = async () => {
    setSaving(true);
    setStatus({ type: "idle" });
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content_type: contentType,
          target_publish_date: targetDate || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.mode === "unconfigured") {
        setStatus({
          type: "info",
          msg: "Creating stories needs SUPABASE_SERVICE_ROLE_KEY set server-side.",
        });
        return;
      }
      setStories((prev) => [body.story as StoryRow, ...prev]);
      setTab((body.story as StoryRow).status);
      closeForm();
      router.refresh();
    } catch (err) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Could not create story" });
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, next: StoryStatus) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/stories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        setStories((prev) => prev.map((s) => (s.id === id ? { ...s, status: next } : s)));
      }
    } finally {
      setUpdating(null);
    }
  };

  const remove = async (id: string, storyTitle: string) => {
    if (!confirm(`Delete "${storyTitle}" permanently?`)) return;
    setUpdating(id);
    try {
      const res = await fetch(`/api/stories/${id}`, { method: "DELETE" });
      if (res.ok) setStories((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div>
      {!configured ? (
        <p className="mb-4 rounded-lg bg-[#FFF4E0] px-3 py-2 text-[12px] text-[#B25E00]">
          Stories needs SUPABASE_SERVICE_ROLE_KEY set server-side — shown empty until then.
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
            className="flex flex-wrap items-end gap-3 border-b border-gray-100 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) void create();
            }}
          >
            <label className="flex min-w-48 flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
              Title
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. CSRD readiness webinar recap"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
              Type
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as StoryContentType)}
                className={inputCls}
              >
                <option value="webinar">Webinar</option>
                <option value="newsletter">Newsletter</option>
                <option value="post">Post</option>
                <option value="social">Social</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
              Target date
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className={inputCls}
              />
            </label>
            <button
              type="submit"
              disabled={saving || !title.trim()}
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
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`shrink-0 rounded-pill px-3 py-1 text-[12px] font-medium transition-colors ${
                  tab === t.key ? "bg-teal-900 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-ink"
                }`}
              >
                {t.label} <span className={tab === t.key ? "opacity-70" : "text-gray-400"}>{counts[t.key] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title…"
              className={`${inputCls} w-48`}
            />
            {!adding && (
              <button
                type="button"
                onClick={openForm}
                className="inline-flex items-center gap-1 rounded-pill bg-teal-900 px-3 py-1 text-[12px] font-medium text-white transition-colors hover:bg-teal-800"
              >
                <Plus size={12} weight="bold" /> New story
              </button>
            )}
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="p-5 text-[13px] text-gray-500">
            {stories.length === 0
              ? "No stories yet — add the first one above."
              : q
                ? `No ${tab} stories match "${query.trim()}".`
                : `No ${tab} stories.`}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {shown.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-ink">{s.title}</span>
                    <Chip tone={CONTENT_TYPE_TONE[s.content_type]}>{s.content_type}</Chip>
                  </div>
                  <div className="mt-0.5 text-[12px] text-gray-500">
                    Target {fmtDate(s.target_publish_date)}
                    {s.notes ? ` · ${s.notes}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Chip tone={STATUS_TONE[s.status]}>{s.status}</Chip>
                  <select
                    value={s.status}
                    onChange={(e) => void updateStatus(s.id, e.target.value as StoryStatus)}
                    disabled={updating === s.id}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-700 disabled:opacity-50"
                  >
                    {STATUS_TABS.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void remove(s.id, s.title)}
                    disabled={updating === s.id}
                    className="rounded-pill border border-red-200 px-2.5 py-1 text-[12px] font-medium text-danger transition-colors hover:bg-red-50 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
