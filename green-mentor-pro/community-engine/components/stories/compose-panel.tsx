"use client";

/**
 * The sources -> angles -> outline -> draft AI-assist flow for a story. Four
 * always-visible sections (not a locked step-wizard) so an admin can revisit
 * an earlier step without losing later ones. Mirrors StoriesPanel's inline-
 * form/status-banner conventions.
 */

import { useState } from "react";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import type { ComposeState, StoryRow } from "@/lib/db/stories";
import type { StorySourceRow } from "@/lib/db/story-sources";

type Status = { type: "idle" | "ok" | "err" | "info"; msg?: string };

const inputCls =
  "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-ink placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500";

const SOURCE_STATUS_TONE: Record<StorySourceRow["status"], "neutral" | "green" | "danger"> = {
  pending: "neutral",
  extracted: "green",
  failed: "danger",
};

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
}: {
  story: StoryRow;
  initialSources: StorySourceRow[];
  onDraftGenerated: (bodyMarkdown: string) => void;
}) {
  const [sources, setSources] = useState<StorySourceRow[]>(initialSources);
  const [compose, setCompose] = useState<ComposeState>(story.compose_state);

  const base = `/api/stories/${story.id}/compose`;

  return (
    <Card className="flex flex-col divide-y divide-gray-100">
      <SourcesSection base={base} sources={sources} setSources={setSources} />
      <AnglesSection base={base} compose={compose} setCompose={setCompose} sourceCount={sources.length} />
      <OutlineSection base={base} compose={compose} setCompose={setCompose} />
      <DraftSection base={base} compose={compose} setCompose={setCompose} onDraftGenerated={onDraftGenerated} />
    </Card>
  );
}

function SourcesSection({
  base,
  sources,
  setSources,
}: {
  base: string;
  sources: StorySourceRow[];
  setSources: (fn: (prev: StorySourceRow[]) => StorySourceRow[]) => void;
}) {
  const [mode, setMode] = useState<"none" | "link" | "text">("none");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [deleting, setDeleting] = useState<string | null>(null);

  const close = () => {
    setMode("none");
    setTitle("");
    setUrl("");
    setText("");
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
      close();
    } catch (err) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Could not add source" });
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

  return (
    <section className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">1. Sources</h3>
        {mode === "none" && (
          <div className="flex gap-2">
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

      {sources.length === 0 ? (
        <p className="text-[13px] text-gray-500">No sources yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-1.5">
              <div className="min-w-0 flex-1 truncate text-[13px] text-ink">{s.title || s.url}</div>
              <Chip tone={SOURCE_STATUS_TONE[s.status]}>{s.status}</Chip>
              <button
                type="button"
                onClick={() => void remove(s.id)}
                disabled={deleting === s.id}
                className="text-[11.5px] font-medium text-danger hover:underline disabled:opacity-40"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AnglesSection({
  base,
  compose,
  setCompose,
  sourceCount,
}: {
  base: string;
  compose: ComposeState;
  setCompose: (c: ComposeState) => void;
  sourceCount: number;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const generate = async () => {
    setBusy(true);
    setStatus({ type: "idle" });
    try {
      const res = await fetch(`${base}/angles`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
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

  return (
    <section className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">2. Angles</h3>
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
      {compose.angles.length === 0 ? (
        <p className="text-[13px] text-gray-500">
          {sourceCount === 0 ? "Add a source first." : "No angles yet."}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
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
}: {
  base: string;
  compose: ComposeState;
  setCompose: (c: ComposeState) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const sorted = [...compose.outline].sort((a, b) => a.order - b.order);

  const generate = async () => {
    setBusy(true);
    setStatus({ type: "idle" });
    try {
      const res = await fetch(`${base}/outline`, { method: "POST" });
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
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">3. Outline</h3>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy || !compose.chosenAngleId}
          className="rounded-pill bg-teal-900 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
        >
          {busy ? "Generating…" : "Generate outline"}
        </button>
      </div>
      <StatusBanner status={status} />
      {sorted.length === 0 ? (
        <p className="text-[13px] text-gray-500">
          {compose.chosenAngleId ? "No outline yet." : "Pick an angle first."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((e, i) => (
            <li key={e.id} className="flex items-start gap-2 rounded-lg border border-gray-200 p-2.5">
              <input
                type="checkbox"
                checked={e.accepted}
                onChange={(ev) => update(e.id, { accepted: ev.target.checked })}
                className="mt-1.5"
              />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <input
                    value={e.heading}
                    onChange={(ev) => update(e.id, { heading: ev.target.value })}
                    className={`${inputCls} flex-1 font-semibold`}
                  />
                  <Chip tone={e.kind === "chart" ? "teal" : "neutral"}>{e.kind}</Chip>
                </div>
                <input
                  value={e.intent}
                  onChange={(ev) => update(e.id, { intent: ev.target.value })}
                  className={`${inputCls} text-gray-600`}
                />
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => move(e.id, -1)}
                  disabled={i === 0}
                  className="text-[11px] text-gray-500 hover:text-ink disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(e.id, 1)}
                  disabled={i === sorted.length - 1}
                  className="text-[11px] text-gray-500 hover:text-ink disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>
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
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">4. Draft</h3>
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
