"use client";

/**
 * Dedicated per-story editor — the equivalent of vismay's StoriesManager row
 * -> ${basePath}/${slug} link. Reached by clicking a story's title in
 * StoriesPanel. Three tabs: Settings (metadata), Body (markdown editor/
 * preview), and Compose with AI (the sources -> angles -> outline -> draft
 * flow that fills the body in). Settings and Body share one form/save action
 * since both persist to the same story row; Compose with AI saves its own
 * stages independently and breaks out to full viewport width for its wider
 * multi-column layout.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import { Card } from "@/components/ui";
import { ComposePanel } from "@/components/stories/compose-panel";
import { StoryBody } from "@/components/stories/story-body";
import { MarkdownEditor } from "@/components/stories/markdown-editor";
import type { StoryContentType, StoryRow, StoryStatus } from "@/lib/db/stories";
import type { StorySourceRow } from "@/lib/db/story-sources";

type Status = { type: "idle" | "ok" | "err"; msg?: string };
type EditTab = "settings" | "body" | "compose";

const inputCls =
  "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-ink placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500";

const labelCls = "flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500";

const TABS: { id: EditTab; label: string }[] = [
  { id: "settings", label: "Settings" },
  { id: "body", label: "Body" },
  { id: "compose", label: "Compose with AI" },
];

export function StoryEditPanel({
  story,
  initialSources,
}: {
  story: StoryRow;
  initialSources: StorySourceRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<EditTab>("settings");
  const [title, setTitle] = useState(story.title);
  const [contentType, setContentType] = useState<StoryContentType>(story.content_type);
  const [storyStatus, setStoryStatus] = useState<StoryStatus>(story.status);
  const [targetDate, setTargetDate] = useState(story.target_publish_date ?? "");
  const [notes, setNotes] = useState(story.notes ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(story.body_markdown ?? "");
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const save = async () => {
    setSaving(true);
    setStatus({ type: "idle" });
    try {
      const res = await fetch(`/api/stories/${story.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content_type: contentType,
          status: storyStatus,
          target_publish_date: targetDate || null,
          notes: notes.trim() || null,
          body_markdown: bodyMarkdown || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      router.push("/stories");
      router.refresh();
    } catch (err) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Could not save story" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${story.title}" permanently?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/stories/${story.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.push("/stories");
      router.refresh();
    } catch (err) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Could not delete story" });
      setDeleting(false);
    }
  };

  return (
    <div>
      {status.type === "err" ? (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-danger">{status.msg}</div>
      ) : null}

      <div role="tablist" className="mb-4 flex flex-wrap items-center gap-1">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={clsx(
                "rounded-lg px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors",
                active ? "bg-teal-900 text-white" : "text-gray-500 hover:bg-gray-100 hover:text-ink"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "compose" ? (
        // Breaks out of the shell's xl:max-w-6xl column — the compose flow's
        // stage grid wants more than that width once it's available. Centered
        // on the viewport (left-1/2 + -translate-x-1/2), width capped at 84rem
        // AND at 100vw-3rem so right-aligned content never lands under the
        // scrollbar / off-screen (a bare 100vw would). Below xl the shell is
        // already unconstrained, so this is a no-op there.
        <div className="xl:relative xl:left-1/2 xl:w-[min(84rem,calc(100vw-3rem))] xl:-translate-x-1/2">
          <ComposePanel
            story={story}
            initialSources={initialSources}
            onDraftGenerated={(md) => {
              setBodyMarkdown(md);
              setTab("body");
            }}
          />
        </div>
      ) : (
        <Card>
          <form
            className="flex flex-col gap-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) void save();
            }}
          >
            {tab === "settings" && (
              <>
                <label className={labelCls}>
                  Title
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inputCls}
                  />
                </label>

                <div className="flex flex-wrap gap-4">
                  <label className={labelCls}>
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
                  <label className={labelCls}>
                    Status
                    <select
                      value={storyStatus}
                      onChange={(e) => setStoryStatus(e.target.value as StoryStatus)}
                      className={inputCls}
                    >
                      <option value="draft">Draft</option>
                      <option value="review">Review</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>
                  <label className={labelCls}>
                    Target date
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className={inputCls}
                    />
                  </label>
                </div>

                <label className={labelCls}>
                  Notes
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Optional"
                    className={`${inputCls} resize-none`}
                  />
                </label>
              </>
            )}

            {tab === "body" && (
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Body</span>
                  <button
                    type="button"
                    onClick={() => setPreviewing((p) => !p)}
                    className="text-[11.5px] font-medium text-gray-500 hover:text-ink"
                  >
                    {previewing ? "Edit" : "Preview"}
                  </button>
                </div>
                {previewing ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <StoryBody markdown={bodyMarkdown} />
                  </div>
                ) : (
                  <MarkdownEditor value={bodyMarkdown} onChange={setBodyMarkdown} />
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => void remove()}
                disabled={deleting || saving}
                className="rounded-pill border border-red-200 px-3 py-1.5 text-[12px] font-medium text-danger transition-colors hover:bg-red-50 disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <div className="flex items-center gap-3">
                <Link href="/stories" className="text-[12px] font-medium text-gray-500 hover:text-ink">
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={saving || deleting || !title.trim()}
                  className="rounded-pill bg-teal-900 px-4 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
