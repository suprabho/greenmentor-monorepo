"use client";

/**
 * Editor surface for vismay-format ("web story") drafts: two Monaco panes
 * over the document pair (markdown body / config JSON) plus a live
 * scrollytelling preview iframe served by /stories/[id]/preview. Saving goes
 * through the parent panel's save action (PUT /api/stories/[id]), which
 * dry-runs the reader path server-side and returns house-style lint warnings.
 */

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { MarkdownEditor } from "@/components/stories/markdown-editor";
import { publicStoryUrl } from "@/lib/share-link";

type Pane = "document" | "config" | "preview";

const PANES: { id: Pane; label: string }[] = [
  { id: "document", label: "Document" },
  { id: "config", label: "Config" },
  { id: "preview", label: "Preview" },
];

export function WebStoryEditor({
  storyId,
  markdown,
  configJson,
  onMarkdownChange,
  onConfigChange,
  warnings,
  previewKey,
}: {
  storyId: string;
  markdown: string;
  configJson: string;
  onMarkdownChange: (next: string) => void;
  onConfigChange: (next: string) => void;
  /** House-style lint warnings from the last save. */
  warnings: string[];
  /** Bumped by the parent on save so the preview iframe reloads. */
  previewKey: number;
}) {
  const [pane, setPane] = useState<Pane>("document");
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  const publish = async () => {
    setPublishing(true);
    setPublishMsg(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/publish`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        publication?: { slug: string | null; id_prefix: string | null };
      };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      const url = publicStoryUrl({
        id: storyId,
        slug: body.publication?.slug,
        id_prefix: body.publication?.id_prefix,
      });
      setPublicUrl(url);
      setPublishMsg({ kind: "ok", text: "Published — the snapshot is live" });
    } catch (err) {
      setPublishMsg({
        kind: "err",
        text: err instanceof Error ? err.message : "Could not publish",
      });
    } finally {
      setPublishing(false);
    }
  };

  const unpublish = async () => {
    if (!confirm("Unpublish this story from the platform?")) return;
    setPublishing(true);
    setPublishMsg(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/publish`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setPublicUrl(null);
      setPublishMsg({ kind: "ok", text: "Unpublished" });
    } catch (err) {
      setPublishMsg({
        kind: "err",
        text: err instanceof Error ? err.message : "Could not unpublish",
      });
    } finally {
      setPublishing(false);
    }
  };

  // Cheap client-side JSON sanity signal (the authoritative validation runs
  // server-side on save).
  const configParseError = useMemo(() => {
    try {
      JSON.parse(configJson);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Invalid JSON";
    }
  }, [configJson]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div role="tablist" className="flex items-center gap-1">
          {PANES.map((p) => {
            const active = pane === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPane(p.id)}
                className={clsx(
                  "rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors",
                  active ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100 hover:text-ink"
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/stories/${storyId}/preview`}
            target="_blank"
            rel="noreferrer"
            className="text-[11.5px] font-medium text-gray-500 hover:text-ink"
          >
            Open preview ↗
          </a>
          <button
            type="button"
            onClick={() => void unpublish()}
            disabled={publishing}
            className="text-[11.5px] font-medium text-gray-400 hover:text-danger disabled:opacity-40"
          >
            Unpublish
          </button>
          <button
            type="button"
            onClick={() => void publish()}
            disabled={publishing}
            className="rounded-pill bg-green-600 px-3 py-1 text-[11.5px] font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-40"
          >
            {publishing ? "Working…" : "Publish to platform"}
          </button>
        </div>
      </div>

      {publishMsg ? (
        <div
          className={clsx(
            "rounded-lg px-3 py-2 text-[12px]",
            publishMsg.kind === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-danger"
          )}
        >
          {publishMsg.text}
          {publishMsg.kind === "ok" && publicUrl ? (
            <>
              {" · "}
              <a href={publicUrl} target="_blank" rel="noreferrer" className="underline">
                {publicUrl}
              </a>
            </>
          ) : null}
        </div>
      ) : null}

      {configParseError && pane === "config" ? (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          Config is not valid JSON: {configParseError}
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          <div className="mb-1 font-semibold">House-style warnings</div>
          <ul className="list-disc pl-4">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {pane === "document" ? (
        <MarkdownEditor value={markdown} onChange={onMarkdownChange} height="480px" />
      ) : null}
      {pane === "config" ? (
        <MarkdownEditor value={configJson} onChange={onConfigChange} language="json" height="480px" />
      ) : null}
      {pane === "preview" ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-950">
          {/* No ?embed=1: StoryShell's embed mode hands scroll control to a
              parent postMessage driver — inside this passive iframe the
              story must own its own snap scroll. */}
          <iframe
            key={previewKey}
            src={`/stories/${storyId}/preview`}
            title="Story preview"
            className="h-[70vh] w-full"
          />
        </div>
      ) : null}
    </div>
  );
}
