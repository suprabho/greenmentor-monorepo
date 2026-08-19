"use client";

/**
 * The sources -> angles -> outline -> draft AI-assist flow for a story.
 * Presented as stage tabs (not a locked step-wizard) so an admin can revisit
 * an earlier step without losing later ones — every stage stays mounted, the
 * tab only toggles visibility. Mirrors StoriesPanel's inline-form/status-
 * banner conventions.
 */

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Plus, CaretUp, CaretDown } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import { findRecapCategory } from "@/lib/recaps/framework";
import type { RecapTopic } from "@/lib/db/recaps";
import { GenerateSection } from "@/components/stories/generate-section";
import { ModelPicker, useTextModel } from "./model-picker";
import { LEGACY_SECTION_KINDS, VISMAY_SECTION_KINDS, type ComposeState, type StoryRow } from "@/lib/db/stories";
import type { StorySourceRow } from "@/lib/db/story-sources";
import { createClient } from "@/lib/supabase/client";
import {
  INLINE_UPLOAD_MAX_BYTES,
  SOURCE_UPLOAD_BUCKET,
  SUPPORTED_SOURCE_EXTS,
} from "@/lib/stories/source-upload";

type Status = { type: "idle" | "ok" | "err" | "info"; msg?: string };
type ComposeTab = "sources" | "angles" | "outline" | "draft";

const inputCls =
  "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-ink placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500";

const cardCls = "flex flex-col gap-2 rounded-lg border border-gray-200 p-3";

const SOURCE_STATUS_TONE: Record<StorySourceRow["status"], "neutral" | "green" | "danger"> = {
  pending: "neutral",
  extracted: "green",
  failed: "danger",
};

/** Matches lib/share-cards/types.ts's ShareCardArticle — fetched read-only
 *  from the existing admin-gated /api/share-cards/data/articles endpoint. */
interface PipelineArticle {
  id: string;
  source: string;
  title: string;
  url: string;
  summary: string | null;
  published_at: string | null;
  entities: { slug: string; name: string; kind: string }[];
}

/** Matches lib/db/recaps.ts's RecapListRow — the /api/recaps picker list. */
interface RecapListItem {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  topics: RecapTopic[];
  generated_at: string;
}

function StatusBanner({ status }: { status: Status }) {
  if (status.type === "idle") return null;
  return (
    <div
      className={`mb-3 rounded-lg px-3 py-2 text-[12px] ${
        status.type === "err"
          ? "bg-red-50 text-danger"
          : status.type === "info"
            ? "bg-[#FFF4E0] text-[#B25E00]"
            : "bg-green-50 text-green-700"
      }`}
    >
      {status.msg}
    </div>
  );
}

export function ComposePanel({
  story,
  initialSources,
  onDraftGenerated,
  onStoryRefreshed,
}: {
  story: StoryRow;
  initialSources: StorySourceRow[];
  onDraftGenerated: (bodyMarkdown: string) => void;
  /** engine 2: server-side generation rewrote the document pair — sync the
   *  editor's panes/preview with the fresh row. */
  onStoryRefreshed?: (row: StoryRow) => void;
}) {
  const [sources, setSources] = useState<StorySourceRow[]>(initialSources);
  const [compose, setCompose] = useState<ComposeState>(story.compose_state);
  const [tab, setTab] = useState<ComposeTab>("sources");

  const base = `/api/stories/${story.id}/compose`;
  const acceptedCount = compose.outline.filter((e) => e.accepted).length;
  // Web stories draft through the pipeline's materialize + per-section flow;
  // the single-shot Draft stage is the legacy blocks path.
  const isWebStory = story.body_format === "vismay";
  // One model for the whole document, honoured by every pipeline stage.
  const { model, setModel, models } = useTextModel(isWebStory);

  const TABS: Array<{ id: ComposeTab; label: string; count: number }> = [
    { id: "sources", label: "Sources", count: sources.length },
    { id: "angles", label: "Angles", count: compose.angles.length },
    { id: "outline", label: "Outline", count: compose.outline.length },
    { id: "draft", label: isWebStory ? "Generate" : "Draft", count: acceptedCount },
  ];

  return (
    <Card className="flex flex-col">
      <div role="tablist" className="flex flex-wrap items-center gap-1 border-b border-gray-100 p-3">
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
              {t.count > 0 && (
                <span
                  className={clsx(
                    "ml-1.5 font-normal normal-case tracking-normal",
                    active ? "text-green-200" : "text-gray-400"
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
        {isWebStory ? <ModelPicker model={model} setModel={setModel} models={models} /> : null}
      </div>

      <div hidden={tab !== "sources"}>
        <SourcesSection
          base={base}
          sources={sources}
          setSources={setSources}
          setCompose={setCompose}
        />
      </div>
      <div hidden={tab !== "angles"}>
        <AnglesSection
          base={base}
          compose={compose}
          setCompose={setCompose}
          sources={sources}
          setSources={setSources}
          model={model}
        />
      </div>
      <div hidden={tab !== "outline"}>
        <OutlineSection base={base} compose={compose} setCompose={setCompose} model={model} />
      </div>
      <div hidden={tab !== "draft"}>
        {isWebStory ? (
          <GenerateSection
            base={base}
            storyId={story.id}
            compose={compose}
            setCompose={setCompose}
            onStoryRefreshed={onStoryRefreshed}
            model={model}
          />
        ) : (
          <DraftSection base={base} compose={compose} setCompose={setCompose} onDraftGenerated={onDraftGenerated} />
        )}
      </div>
    </Card>
  );
}

function SourcesSection({
  base,
  sources,
  setSources,
  setCompose,
}: {
  base: string;
  sources: StorySourceRow[];
  setSources: (fn: (prev: StorySourceRow[]) => StorySourceRow[]) => void;
  /** Attaching a recap updates compose_state server-side (recapId) — the
   *  response carries it back so the Angles tab sees the topic picker. */
  setCompose: (c: ComposeState) => void;
}) {
  const [mode, setMode] = useState<"none" | "link" | "text" | "library" | "recap">("none");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  // The file input is hidden and driven by the "Upload file" pill, so the row of
  // controls stays visually consistent.
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [articles, setArticles] = useState<PipelineArticle[] | null>(null);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [recaps, setRecaps] = useState<RecapListItem[] | null>(null);
  const [loadingRecaps, setLoadingRecaps] = useState(false);
  const [recapUrls, setRecapUrls] = useState("");
  const [generatingRecap, setGeneratingRecap] = useState(false);

  const close = () => {
    setMode("none");
    setTitle("");
    setUrl("");
    setText("");
    setQuery("");
    setRecapUrls("");
  };

  const openLibrary = async () => {
    setMode("library");
    setStatus({ type: "idle" });
    if (articles !== null) return;
    setLoadingArticles(true);
    try {
      const res = await fetch("/api/share-cards/data/articles?limit=200");
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setArticles(body.items as PipelineArticle[]);
    } catch (err) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Could not load the library" });
    } finally {
      setLoadingArticles(false);
    }
  };

  const add = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setStatus({ type: "idle" });
    try {
      const res = await fetch(`${base}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.mode === "unconfigured") {
        setStatus({ type: "info", msg: "Sources need SUPABASE_SERVICE_ROLE_KEY set server-side." });
        return;
      }
      setSources((prev) => [...prev, body.source as StorySourceRow]);
      // The recap kind also rewrites compose_state (recapId) server-side.
      if (body.compose_state) setCompose(body.compose_state as ComposeState);
      close();
    } catch (err) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Could not add source" });
    } finally {
      setSaving(false);
    }
  };

  const openRecaps = async () => {
    setMode("recap");
    setStatus({ type: "idle" });
    if (recaps !== null) return;
    setLoadingRecaps(true);
    try {
      const res = await fetch("/api/recaps");
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setRecaps((body.recaps ?? []) as RecapListItem[]);
    } catch (err) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Could not load recaps" });
    } finally {
      setLoadingRecaps(false);
    }
  };

  // Generate a fresh weekly recap (last 7 days of feed news + any pasted
  // URLs), then attach it in the same motion — the common case is "recap me
  // this week and let me pick a topic", not browsing old snapshots.
  const generateRecap = async () => {
    setGeneratingRecap(true);
    setStatus({ type: "info", msg: "Generating the recap — this takes a minute…" });
    try {
      const urls = recapUrls
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);
      const res = await fetch("/api/recaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.mode === "unconfigured") {
        setStatus({ type: "info", msg: "Recaps need SUPABASE_SERVICE_ROLE_KEY set server-side." });
        return;
      }
      const recap = body.recap as RecapListItem;
      setRecaps((prev) => [recap, ...(prev ?? [])]);
      await add({ kind: "recap", recapId: recap.id });
      // After add() (which resets status): keep skipped-URL warnings visible.
      if (Array.isArray(body.warnings) && body.warnings.length > 0) {
        setStatus({ type: "info", msg: (body.warnings as string[]).join(" · ") });
      }
    } catch (err) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Could not generate a recap" });
    } finally {
      setGeneratingRecap(false);
    }
  };

  /**
   * Upload a source file, choosing the transport by size.
   *
   * Up to 4MB goes inline as multipart. Anything larger CANNOT reach a route
   * handler at all (~4.5MB request-body ceiling), so it takes the signed-URL path:
   * ask for a token, PUT the bytes straight to a private bucket, then hand the
   * route the storage path to extract from. The caller doesn't choose — the
   * distinction is transport, not intent.
   */
  const upload = async (file: File) => {
    setSaving(true);
    setStatus({ type: "idle" });
    try {
      let body: Record<string, unknown>;

      if (file.size <= INLINE_UPLOAD_MAX_BYTES) {
        const form = new FormData();
        form.set("file", file);
        // No Content-Type header: the browser must set the multipart boundary.
        const res = await fetch(`${base}/sources`, { method: "POST", body: form });
        body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((body.error as string) ?? `HTTP ${res.status}`);
      } else {
        const ticketRes = await fetch(`${base}/sources/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, size: file.size }),
        });
        const ticket = (await ticketRes.json().catch(() => ({}))) as {
          bucket?: string;
          path?: string;
          token?: string;
          error?: string;
        };
        if (!ticketRes.ok || !ticket.path || !ticket.token) {
          throw new Error(ticket.error ?? `HTTP ${ticketRes.status}`);
        }
        const { error: putError } = await createClient()
          .storage.from(ticket.bucket ?? SOURCE_UPLOAD_BUCKET)
          // `upsert: false` — the path is a fresh uuid per ticket, so a collision
          // would mean the token was replayed.
          .uploadToSignedUrl(ticket.path, ticket.token, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (putError) throw new Error(`Upload failed: ${putError.message}`);

        // Extraction is a separate call so its failure is distinguishable from the
        // upload's, and so the (slow) parse isn't holding a request open behind a
        // multi-megabyte body.
        const res = await fetch(`${base}/sources`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "upload", path: ticket.path, title: file.name }),
        });
        body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((body.error as string) ?? `HTTP ${res.status}`);
      }

      if (body.mode === "unconfigured") {
        setStatus({ type: "info", msg: "Uploads need SUPABASE_SERVICE_ROLE_KEY set server-side." });
        return;
      }
      const source = body.source as StorySourceRow;
      setSources((prev) => [...prev, source]);
      // A row can land `status: 'failed'` with a 200 — the row IS the record of the
      // failure, so surface its reason rather than a silent success.
      if (source.status === "failed") {
        setStatus({ type: "err", msg: source.error ?? "That file could not be read." });
      } else if (typeof body.warning === "string") {
        setStatus({ type: "info", msg: body.warning });
      }
      close();
    } catch (err) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Could not upload file" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`${base}/sources/${id}`, { method: "DELETE" });
      if (res.ok) setSources((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  // Pull recent posts from the GreenMentor Substack as link sources — grounding
  // (and voice reference) for the draft, in one click.
  const importSubstack = async () => {
    setImporting(true);
    setStatus({ type: "idle" });
    try {
      const res = await fetch(`${base}/sources/substack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 5 }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.mode === "unconfigured") {
        setStatus({ type: "info", msg: "Sources need SUPABASE_SERVICE_ROLE_KEY set server-side." });
        return;
      }
      const imported = (body.sources ?? []) as StorySourceRow[];
      setSources((prev) => [...prev, ...imported]);
      setStatus({ type: "ok", msg: `Imported ${imported.length} Substack post${imported.length === 1 ? "" : "s"}.` });
    } catch (err) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Could not import from Substack" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Sources</h3>
        {mode === "none" && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("link")}
              className="inline-flex items-center gap-1 rounded-pill border border-gray-200 px-2.5 py-1 text-[12px] font-medium text-gray-700 hover:bg-gray-50"
            >
              <Plus size={11} weight="bold" /> Add link
            </button>
            <button
              type="button"
              onClick={() => setMode("text")}
              className="inline-flex items-center gap-1 rounded-pill border border-gray-200 px-2.5 py-1 text-[12px] font-medium text-gray-700 hover:bg-gray-50"
            >
              <Plus size={11} weight="bold" /> Paste text
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-pill border border-gray-200 px-2.5 py-1 text-[12px] font-medium text-gray-700 hover:bg-gray-50"
            >
              <Plus size={11} weight="bold" /> Upload file
            </button>
            {/* Hidden, driven by the button above — a bare file input can't be
                styled to match the pill row. Derived from the extractor's own list
                so the picker can't drift from what the server accepts. */}
            <input
              ref={fileRef}
              type="file"
              accept={SUPPORTED_SOURCE_EXTS.join(",")}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Reset first so re-picking the same file fires `change` again.
                e.target.value = "";
                if (file) void upload(file);
              }}
            />
            <button
              type="button"
              onClick={() => void openLibrary()}
              className="inline-flex items-center gap-1 rounded-pill border border-gray-200 px-2.5 py-1 text-[12px] font-medium text-gray-700 hover:bg-gray-50"
            >
              <Plus size={11} weight="bold" /> From library
            </button>
            <button
              type="button"
              onClick={() => void importSubstack()}
              disabled={importing}
              className="inline-flex items-center gap-1 rounded-pill border border-green-600 px-2.5 py-1 text-[12px] font-medium text-green-700 hover:bg-green-50 disabled:opacity-40"
            >
              <Plus size={11} weight="bold" /> {importing ? "Importing…" : "From Substack"}
            </button>
            <button
              type="button"
              onClick={() => void openRecaps()}
              className="inline-flex items-center gap-1 rounded-pill border border-teal-900 px-2.5 py-1 text-[12px] font-medium text-teal-900 hover:bg-teal-50 disabled:opacity-40"
            >
              <Plus size={11} weight="bold" /> From recap
            </button>
          </div>
        )}
      </div>

      <StatusBanner status={status} />

      {mode === "link" && (
        <form
          className="mb-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) void add({ kind: "link", url: url.trim(), title: title.trim() || undefined });
          }}
        >
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className={`${inputCls} min-w-56 flex-1`}
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className={`${inputCls} w-40`}
          />
          <button
            type="submit"
            disabled={saving || !url.trim()}
            className="rounded-pill bg-teal-900 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
          >
            {saving ? "Adding…" : "Add"}
          </button>
          <button type="button" onClick={close} className="text-[12px] text-gray-500 hover:text-ink">
            Cancel
          </button>
        </form>
      )}

      {mode === "text" && (
        <form
          className="mb-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) void add({ kind: "text", text: text.trim(), title: title.trim() || undefined });
          }}
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className={inputCls}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Paste text…"
            className={`${inputCls} resize-y`}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !text.trim()}
              className="rounded-pill bg-teal-900 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
            >
              {saving ? "Adding…" : "Add"}
            </button>
            <button type="button" onClick={close} className="text-[12px] text-gray-500 hover:text-ink">
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === "library" && (
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, source, or tag…"
              className={`${inputCls} flex-1`}
            />
            <button type="button" onClick={close} className="text-[12px] text-gray-500 hover:text-ink">
              Cancel
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
            {loadingArticles ? (
              <p className="p-3 text-[13px] text-gray-500">Loading…</p>
            ) : (
              (() => {
                const q = query.trim().toLowerCase();
                const tokens = q.split(/\s+/).filter(Boolean);
                const shown = (articles ?? []).filter((a) => {
                  if (tokens.length === 0) return true;
                  const haystack = `${a.title} ${a.source} ${a.entities.map((e) => e.name).join(" ")}`.toLowerCase();
                  return tokens.every((t) => haystack.includes(t));
                });
                if (shown.length === 0) {
                  return <p className="p-3 text-[13px] text-gray-500">No articles match.</p>;
                }
                return (
                  <ul className="divide-y divide-gray-100">
                    {shown.slice(0, 40).map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void add({ kind: "pipeline", articleId: a.id })}
                          className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-40"
                        >
                          <span className="text-[13px] font-medium text-ink">{a.title}</span>
                          <span className="text-[11.5px] text-gray-500">
                            {a.source}
                            {a.published_at ? ` · ${new Date(a.published_at).toLocaleDateString()}` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                );
              })()
            )}
          </div>
        </div>
      )}

      {mode === "recap" && (
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] text-gray-500">
              Attach a weekly ESG recap, then pick one of its topics in the Angles tab.
            </p>
            <button type="button" onClick={close} className="text-[12px] text-gray-500 hover:text-ink">
              Cancel
            </button>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
            <textarea
              value={recapUrls}
              onChange={(e) => setRecapUrls(e.target.value)}
              rows={3}
              placeholder={"Optional: curated URLs for the recap, one per line\nhttps://…"}
              className={`${inputCls} resize-y font-mono text-[12px]`}
            />
            <div>
              <button
                type="button"
                onClick={() => void generateRecap()}
                disabled={generatingRecap || saving}
                className="rounded-pill bg-teal-900 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
              >
                {generatingRecap ? "Generating…" : "Generate this week's recap"}
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
            {loadingRecaps ? (
              <p className="p-3 text-[13px] text-gray-500">Loading…</p>
            ) : (recaps ?? []).length === 0 ? (
              <p className="p-3 text-[13px] text-gray-500">
                No recaps yet — generate one above, or wait for the Monday worker.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {(recaps ?? []).map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      disabled={saving || generatingRecap}
                      onClick={() => void add({ kind: "recap", recapId: r.id })}
                      className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-40"
                    >
                      <span className="text-[13px] font-medium text-ink">{r.title}</span>
                      <span className="text-[11.5px] text-gray-500">
                        {r.period_start} → {r.period_end} · {r.topics.length} topic
                        {r.topics.length === 1 ? "" : "s"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {sources.length === 0 ? (
        <p className="text-[13px] text-gray-500">No sources yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sources.map((s) => (
            <div key={s.id} className={cardCls}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {s.kind === "pipeline" ? <Chip tone="teal">library</Chip> : null}
                  {s.kind === "recap" ? <Chip tone="teal">recap</Chip> : null}
                  <Chip tone={SOURCE_STATUS_TONE[s.status]}>{s.status}</Chip>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(s.id)}
                  disabled={deleting === s.id}
                  className="shrink-0 text-[11.5px] font-medium text-danger hover:underline disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
              <div className="truncate text-[13px] font-semibold text-ink" title={s.title || s.url || undefined}>
                {s.title || s.url}
              </div>
              {s.title && s.url && (
                <div className="truncate text-[11.5px] text-gray-500" title={s.url}>
                  {s.url}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AnglesSection({
  base,
  compose,
  setCompose,
  sources,
  setSources,
  model,
}: {
  base: string;
  compose: ComposeState;
  setCompose: (c: ComposeState) => void;
  sources: StorySourceRow[];
  /** Picking a recap topic attaches that topic's grounding sources server-side. */
  setSources: (fn: (prev: StorySourceRow[]) => StorySourceRow[]) => void;
  model?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const sourceCount = sources.length;

  // The topic picker needs the attached recap's full topics; the source row
  // only carries condensed text. Gate on the source actually existing so a
  // stale compose_state.recapId (source deleted elsewhere) shows nothing.
  const hasRecapSource = sources.some((s) => s.kind === "recap");
  const recapId = hasRecapSource ? (compose.recapId ?? null) : null;
  const [recapTopics, setRecapTopics] = useState<RecapTopic[] | null>(null);
  const [pickingTopic, setPickingTopic] = useState<string | null>(null);

  useEffect(() => {
    if (!recapId) {
      setRecapTopics(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/recaps/${recapId}`);
        const body = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && body.recap) {
          setRecapTopics((body.recap.topics ?? []) as RecapTopic[]);
        }
      } catch {
        // best-effort — the picker just won't render
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recapId]);

  const generate = async () => {
    setBusy(true);
    setStatus({ type: "idle" });
    try {
      const res = await fetch(`${base}/angles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(model ? { model } : {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setCompose(body.compose_state as ComposeState);
    } catch (err) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Could not generate angles" });
    } finally {
      setBusy(false);
    }
  };

  const choose = async (chosenAngleId: string) => {
    try {
      const res = await fetch(`${base}/angles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chosenAngleId }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) setCompose(body.compose_state as ComposeState);
    } catch {
      // best-effort — the select click just won't stick, no crash
    }
  };

  // Pick ONE recap topic: the server attaches its grounding sources + snapshots
  // the topic into compose_state, then angles regenerate under its steer.
  const pickTopic = async (recapTopicId: string) => {
    setPickingTopic(recapTopicId);
    setStatus({ type: "idle" });
    try {
      const res = await fetch(`${base}/recap-topic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recapTopicId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.compose_state) setCompose(body.compose_state as ComposeState);
      if (Array.isArray(body.sources)) {
        setSources(() => body.sources as StorySourceRow[]);
      }
      await generate();
    } catch (err) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Could not pick that topic" });
    } finally {
      setPickingTopic(null);
    }
  };

  return (
    <section className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Angles</h3>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy || sourceCount === 0}
          className="rounded-pill bg-teal-900 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
        >
          {busy ? "Generating…" : "Generate angles"}
        </button>
      </div>
      <StatusBanner status={status} />
      {recapTopics && recapTopics.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
            Pick a recap topic
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recapTopics.map((t) => {
              const selected = compose.recapTopicId === t.id;
              const picking = pickingTopic === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={busy || pickingTopic !== null}
                  onClick={() => void pickTopic(t.id)}
                  className={`rounded-lg border p-3 text-left transition-colors disabled:opacity-60 ${
                    selected ? "border-teal-900 bg-green-50" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="mb-1">
                    <Chip tone="teal">{findRecapCategory(t.category)?.name ?? t.category}</Chip>
                  </div>
                  <div className="text-[13px] font-semibold text-ink">
                    {picking ? "Attaching sources…" : t.title}
                  </div>
                  <div className="mt-0.5 text-[12px] text-gray-600">{t.summary}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {compose.angles.length === 0 ? (
        <p className="text-[13px] text-gray-500">
          {sourceCount === 0 ? "Add a source first." : "No angles yet."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {compose.angles.map((a) => {
            const chosen = compose.chosenAngleId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => void choose(a.id)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  chosen ? "border-teal-900 bg-green-50" : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="text-[13px] font-semibold text-ink">{a.title}</div>
                <div className="mt-0.5 text-[12px] text-gray-600">{a.thesis}</div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function OutlineSection({
  base,
  compose,
  setCompose,
  model,
}: {
  base: string;
  compose: ComposeState;
  setCompose: (c: ComposeState) => void;
  model?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [guidance, setGuidance] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sorted = [...compose.outline].sort((a, b) => a.order - b.order);
  // Selection is tracked by id so it follows a section through reorders; falls
  // back to the first section when nothing is selected yet or the id is stale.
  const selected = sorted.find((e) => e.id === selectedId) ?? sorted[0] ?? null;
  // Engine 2 (vismay) outlines use a much larger kind vocabulary than engine 1
  // (legacy) — the section-type control must offer whichever one produced
  // this outline, or edits silently overwrite a valid kind with a bogus one.
  const isVismay = compose.engine === 2;
  const sectionKinds = isVismay ? VISMAY_SECTION_KINDS : LEGACY_SECTION_KINDS;
  const isChartLike = (kind: string) => (isVismay ? kind === "data" || kind === "stat" || kind === "bigStat" : kind === "chart");

  const generate = async () => {
    setBusy(true);
    setStatus({ type: "idle" });
    try {
      const res = await fetch(`${base}/outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guidance: guidance.trim() || undefined, ...(model ? { model } : {}) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setCompose(body.compose_state as ComposeState);
    } catch (err) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Could not generate outline" });
    } finally {
      setBusy(false);
    }
  };

  const persist = async (next: ComposeState["outline"]) => {
    setCompose({ ...compose, outline: next });
    try {
      await fetch(`${base}/outline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outline: next }),
      });
    } catch {
      // best-effort — local state already reflects the edit
    }
  };

  const update = (id: string, patch: Partial<ComposeState["outline"][number]>) => {
    void persist(compose.outline.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = sorted.findIndex((e) => e.id === id);
    const swapWith = idx + dir;
    if (idx < 0 || swapWith < 0 || swapWith >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[swapWith]] = [reordered[swapWith]!, reordered[idx]!];
    void persist(reordered.map((e, i) => ({ ...e, order: i })));
  };

  return (
    <section className="p-5">
      <div className="mb-3 flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Outline</h3>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && compose.chosenAngleId) void generate();
          }}
        >
          <input
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            placeholder="Optional guidance for the outline (e.g. focus on SMB Scope 3 barriers)…"
            disabled={busy || !compose.chosenAngleId}
            className={`${inputCls} flex-1 disabled:opacity-40`}
          />
          <button
            type="submit"
            disabled={busy || !compose.chosenAngleId}
            className="shrink-0 rounded-pill bg-teal-900 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
          >
            {busy ? "Generating…" : "Generate outline"}
          </button>
        </form>
      </div>
      <StatusBanner status={status} />
      {sorted.length === 0 ? (
        <p className="text-[13px] text-gray-500">
          {compose.chosenAngleId ? "No outline yet." : "Pick an angle first."}
        </p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          {/* List — reorder + select, kept compact so the detail pane does the editing. */}
          <ul className="flex flex-col gap-1.5">
            {sorted.map((e, i) => {
              const active = selected?.id === e.id;
              return (
                <li key={e.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(e.id)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        setSelectedId(e.id);
                      }
                    }}
                    className={clsx(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors",
                      active ? "border-teal-900 bg-green-50" : "border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={e.accepted}
                      onClick={(ev) => ev.stopPropagation()}
                      onChange={(ev) => update(e.id, { accepted: ev.target.checked })}
                      className="shrink-0"
                      aria-label="Include in draft"
                    />
                    <span className="shrink-0 font-mono text-[10px] text-gray-400">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={clsx(
                        "flex-1 truncate text-[13px] font-medium",
                        e.accepted ? "text-ink" : "text-gray-400"
                      )}
                      title={e.heading || undefined}
                    >
                      {e.heading || "Untitled section"}
                    </span>
                    <Chip tone={isChartLike(e.kind) ? "teal" : "neutral"}>{e.kind}</Chip>
                    <div className="flex shrink-0 flex-col text-gray-400">
                      <button
                        type="button"
                        aria-label="Move up"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          move(e.id, -1);
                        }}
                        disabled={i === 0}
                        className="rounded p-0.5 hover:text-ink disabled:opacity-25"
                      >
                        <CaretUp size={12} weight="bold" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          move(e.id, 1);
                        }}
                        disabled={i === sorted.length - 1}
                        className="rounded p-0.5 hover:text-ink disabled:opacity-25"
                      >
                        <CaretDown size={12} weight="bold" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Detail — edit the selected section's heading, type, and prompt/content. */}
          {selected ? (
            <div className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                  Heading
                </label>
                <input
                  value={selected.heading}
                  onChange={(ev) => update(selected.id, { heading: ev.target.value })}
                  className={`${inputCls} font-semibold`}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                  Section type
                </label>
                {isVismay ? (
                  <select
                    value={selected.kind}
                    onChange={(ev) => update(selected.id, { kind: ev.target.value })}
                    className={`${inputCls} w-fit capitalize`}
                  >
                    {sectionKinds.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="inline-flex w-fit rounded-lg border border-gray-200 p-0.5">
                    {sectionKinds.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => update(selected.id, { kind: k })}
                        className={clsx(
                          "rounded-[7px] px-3 py-1 text-[12px] font-medium capitalize transition-colors",
                          selected.kind === k ? "bg-teal-900 text-white" : "text-gray-500 hover:text-ink"
                        )}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                  {isChartLike(selected.kind) ? "Chart prompt" : "Content"}
                </label>
                <p className="text-[11.5px] text-gray-500">
                  {isChartLike(selected.kind)
                    ? "Describe the data or comparison this chart should visualise."
                    : "What this section should cover."}
                </p>
                <textarea
                  value={selected.intent}
                  onChange={(ev) => update(selected.id, { intent: ev.target.value })}
                  rows={isChartLike(selected.kind) ? 5 : 4}
                  className={`${inputCls} resize-y text-gray-700`}
                />
              </div>

              <label className="flex items-center gap-2 text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  checked={selected.accepted}
                  onChange={(ev) => update(selected.id, { accepted: ev.target.checked })}
                />
                Include this section in the draft
              </label>
            </div>
          ) : (
            <div className="grid place-items-center rounded-lg border border-dashed border-gray-200 p-8 text-[13px] text-gray-400">
              Select a section to edit
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function DraftSection({
  base,
  compose,
  setCompose,
  onDraftGenerated,
}: {
  base: string;
  compose: ComposeState;
  setCompose: (c: ComposeState) => void;
  onDraftGenerated: (bodyMarkdown: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const acceptedCount = compose.outline.filter((e) => e.accepted).length;

  const generate = async () => {
    setBusy(true);
    setStatus({ type: "idle" });
    try {
      const res = await fetch(`${base}/draft`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setCompose(body.compose_state as ComposeState);
      onDraftGenerated(body.body_markdown as string);
      setStatus({ type: "ok", msg: "Draft generated — see the Body field above." });
    } catch (err) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Could not generate draft" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Draft</h3>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy || acceptedCount === 0}
          className="rounded-pill bg-teal-900 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
        >
          {busy ? "Generating…" : "Generate draft"}
        </button>
      </div>
      <StatusBanner status={status} />
      {acceptedCount === 0 ? (
        <p className="text-[13px] text-gray-500">Accept at least one outline section first.</p>
      ) : (
        <p className="text-[13px] text-gray-500">{acceptedCount} section(s) accepted and ready to draft.</p>
      )}
    </section>
  );
}
