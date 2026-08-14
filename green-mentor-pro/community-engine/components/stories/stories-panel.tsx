"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { AdminEditPanel, AdminTable, type AdminTableColumn, useAdminPanel } from "@/components/admin";
import { Chip } from "@/components/ui";
import { StoryEditPanel } from "@/components/stories/story-edit-panel";
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
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Story format choices: the classic flat-markdown body ("blocks") or one of
 * the @gm/story-vertical scrollytelling templates (creates a
 * body_format:'vismay' draft seeded with that template's spine).
 */
const FORMAT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Classic (markdown body)" },
  { value: "analytical-briefing", label: "Web story — Analytical Briefing" },
  { value: "case-study", label: "Web story — Case Study" },
  { value: "photo-essay", label: "Web story — Photo Essay" },
  { value: "social-teaser", label: "Web story — Social Teaser" },
];

function NewStoryForm({
  title,
  setTitle,
  contentType,
  setContentType,
  targetDate,
  setTargetDate,
  template,
  setTemplate,
  saving,
  onSubmit,
  onClose,
}: {
  title: string;
  setTitle: (value: string) => void;
  contentType: StoryContentType;
  setContentType: (value: StoryContentType) => void;
  targetDate: string;
  setTargetDate: (value: string) => void;
  template: string;
  setTemplate: (value: string) => void;
  saving: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const { setDirty } = useAdminPanel();
  useEffect(
    () => setDirty(Boolean(title || targetDate || template || contentType !== "post")),
    [contentType, setDirty, targetDate, template, title],
  );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim()) onSubmit();
      }}
    >
      <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
        Title
        <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. CSRD readiness webinar recap" className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
        Type
        <select value={contentType} onChange={(event) => setContentType(event.target.value as StoryContentType)} className={inputCls}>
          <option value="webinar">Webinar</option>
          <option value="newsletter">Newsletter</option>
          <option value="post">Post</option>
          <option value="social">Social</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
        Format
        <select value={template} onChange={(event) => setTemplate(event.target.value)} className={inputCls}>
          {FORMAT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
        Target date
        <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className={inputCls} />
      </label>
      <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
        <button type="submit" disabled={saving || !title.trim()} className="rounded-pill bg-teal-900 px-4 py-1.5 text-[12px] font-medium text-white hover:bg-teal-800 disabled:opacity-40">
          {saving ? "Adding…" : "Add story"}
        </button>
        <button type="button" onClick={onClose} className="text-[12px] font-medium text-gray-500 hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function StoriesPanel({ initialStories, configured }: { initialStories: StoryRow[]; configured: boolean }) {
  const router = useRouter();
  const [stories, setStories] = useState<StoryRow[]>(initialStories);
  const [tab, setTab] = useState<StoryStatus>("draft");
  const [query, setQuery] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<StoryRow | null>(null);
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<StoryContentType>("post");
  const [targetDate, setTargetDate] = useState("");
  const [template, setTemplate] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const story of stories) result[story.status] = (result[story.status] ?? 0) + 1;
    return result;
  }, [stories]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      stories
        .filter((story) => story.status === tab)
        .filter((story) => !q || story.title.toLowerCase().includes(q))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [q, stories, tab],
  );

  const closeCreate = () => {
    setAdding(false);
    setTitle("");
    setTargetDate("");
    setContentType("post");
    setTemplate("");
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
          template: template || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not create story");
      if (body.mode === "unconfigured") {
        setStatus({ type: "info", msg: "Creating stories needs SUPABASE_SERVICE_ROLE_KEY set server-side." });
        return;
      }
      const story = body.story as StoryRow;
      setStories((prev) => [story, ...prev]);
      setTab(story.status);
      closeCreate();
      router.refresh();
    } catch (error) {
      setStatus({ type: "err", msg: error instanceof Error ? error.message : "Could not create story" });
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, next: StoryStatus) => {
    setUpdating(id);
    try {
      const res = await fetch("/api/stories/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) setStories((prev) => prev.map((story) => (story.id === id ? { ...story, status: next } : story)));
    } finally {
      setUpdating(null);
    }
  };

  const remove = async (id: string, storyTitle: string) => {
    if (!confirm('Delete "' + storyTitle + '" permanently?')) return;
    setUpdating(id);
    try {
      const res = await fetch("/api/stories/" + id, { method: "DELETE" });
      if (res.ok) setStories((prev) => prev.filter((story) => story.id !== id));
    } finally {
      setUpdating(null);
    }
  };

  const columns: AdminTableColumn<StoryRow>[] = [
    {
      key: "story",
      label: "Story",
      render: (story) => (
        <button type="button" onClick={() => setEditing(story)} className="text-left font-semibold text-ink hover:text-green-700">
          <span className="block truncate">{story.title}</span>
          <span className="mt-0.5 block text-[11.5px] font-normal text-gray-500">{story.notes || "No notes"}</span>
        </button>
      ),
    },
    {
      key: "type",
      label: "Type",
      responsive: "secondary",
      render: (story) => <Chip tone={CONTENT_TYPE_TONE[story.content_type]}>{story.content_type}</Chip>,
    },
    {
      key: "target",
      label: "Target",
      responsive: "secondary",
      className: "whitespace-nowrap text-gray-600",
      render: (story) => fmtDate(story.target_publish_date),
    },
    {
      key: "status",
      label: "Status",
      className: "w-36",
      render: (story) => (
        <div className="flex items-center gap-2">
          <Chip tone={STATUS_TONE[story.status]}>{story.status}</Chip>
          <select
            value={story.status}
            onChange={(event) => void updateStatus(story.id, event.target.value as StoryStatus)}
            disabled={updating === story.id}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-700 disabled:opacity-50"
            aria-label={"Change status for " + story.title}
          >
            {STATUS_TABS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sticky: true,
      className: "w-32 text-right",
      render: (story) => (
        <div className="flex items-center justify-end gap-2">
          <Link href={"/stories/" + story.id} className="text-[12px] font-medium text-gray-500 hover:text-ink">Open</Link>
          <button type="button" onClick={() => void remove(story.id, story.title)} disabled={updating === story.id} className="text-[12px] font-medium text-danger hover:underline disabled:opacity-40">
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {!configured ? <p className="mb-4 rounded-lg bg-[#FFF4E0] px-3 py-2 text-[12px] text-[#B25E00]">Stories needs SUPABASE_SERVICE_ROLE_KEY set server-side — shown empty until then.</p> : null}
      {status.type !== "idle" ? (
        <div className={"mb-4 rounded-lg px-3 py-2 text-[12px] " + (status.type === "err" ? "bg-red-50 text-danger" : status.type === "info" ? "bg-[#FFF4E0] text-[#B25E00]" : "bg-green-50 text-green-700")}>
          {status.msg}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {STATUS_TABS.map((item) => (
            <button key={item.key} type="button" onClick={() => setTab(item.key)} className={"shrink-0 rounded-pill px-3 py-1 text-[12px] font-medium " + (tab === item.key ? "bg-teal-900 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-ink")}>
              {item.label} <span className={tab === item.key ? "opacity-70" : "text-gray-400"}>{counts[item.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title…" className={inputCls + " w-48"} />
          <button type="button" onClick={() => { setAdding(true); setStatus({ type: "idle" }); }} className="inline-flex items-center gap-1 rounded-pill bg-teal-900 px-3 py-1 text-[12px] font-medium text-white hover:bg-teal-800">
            <Plus size={12} weight="bold" /> New story
          </button>
        </div>
      </div>

      <AdminTable
        rows={shown}
        columns={columns}
        rowKey={(story) => story.id}
        caption="Stories"
        empty={stories.length === 0 ? "No stories yet — add the first one above." : q ? 'No ' + tab + ' stories match "' + query.trim() + '".' : "No " + tab + " stories."}
      />

      <AdminEditPanel open={adding} onClose={closeCreate} title="New story">
        <NewStoryForm
          title={title}
          setTitle={setTitle}
          contentType={contentType}
          setContentType={setContentType}
          targetDate={targetDate}
          setTargetDate={setTargetDate}
          template={template}
          setTemplate={setTemplate}
          saving={saving}
          onSubmit={() => void create()}
          onClose={closeCreate}
        />
      </AdminEditPanel>

      <AdminEditPanel open={editing !== null} onClose={() => setEditing(null)} title={editing ? "Edit story" : "Edit story"} size="wide">
        {editing ? (
          <StoryEditPanel
            story={editing}
            initialSources={[]}
            onSaved={(patch) => setStories((prev) => prev.map((story) => story.id === editing.id ? { ...story, ...patch } : story))}
            onDeleted={() => {
              setStories((prev) => prev.filter((story) => story.id !== editing.id));
              setEditing(null);
            }}
          />
        ) : null}
      </AdminEditPanel>
    </div>
  );
}
