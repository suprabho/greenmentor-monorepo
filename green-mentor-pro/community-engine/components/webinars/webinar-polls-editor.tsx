"use client";

/**
 * Polls sub-editor, rendered inside a webinar's expanded row in the Webinars
 * panel. Loads the webinar's polls on mount and supports create / edit /
 * delete against the nested /api/webinars/[id]/polls routes. Options are edited
 * as an ordered in-memory array (like the InstructorPicker) and saved with the
 * poll. Same plain useState + fetch + router.refresh idioms as the rest of the
 * admin hub — no form library.
 */

import { useEffect, useState } from "react";
import { Plus, X } from "@phosphor-icons/react/dist/ssr";
import type { WebinarPollStatus, WebinarPollWithOptions } from "@/lib/db/webinar-polls";

const inputCls =
  "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-ink placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500";
const labelCls = "flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500";

const POLL_STATUSES: { key: WebinarPollStatus; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "published", label: "Published" },
  { key: "closed", label: "Closed" },
];

/** Free-text ordered options editor — add via input, remove via chip. */
function OptionsEditor({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...value, v]);
    setDraft("");
  };
  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((opt, i) => (
            <span
              key={`${opt}-${i}`}
              className="inline-flex items-center gap-1 rounded-pill bg-teal-50 px-2.5 py-1 text-[12px] font-medium text-teal-900"
            >
              {opt}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="text-teal-700 hover:text-teal-900"
                aria-label="Remove option"
              >
                <X size={12} weight="bold" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add an option and press Enter"
          className={`${inputCls} flex-1`}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="inline-flex items-center gap-1 rounded-pill border border-gray-200 px-2.5 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
        >
          <Plus size={12} weight="bold" /> Add
        </button>
      </div>
    </div>
  );
}

interface PollDraft {
  question: string;
  options: string[];
  status: WebinarPollStatus;
}

const EMPTY_DRAFT: PollDraft = { question: "", options: [], status: "draft" };

export function WebinarPollsEditor({ webinarId }: { webinarId: string }) {
  const [polls, setPolls] = useState<WebinarPollWithOptions[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PollDraft>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState<PollDraft>(EMPTY_DRAFT);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/webinars/${webinarId}/polls`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        if (!cancelled) setPolls((body.polls as WebinarPollWithOptions[]) ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load polls");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [webinarId]);

  const reload = async () => {
    const res = await fetch(`/api/webinars/${webinarId}/polls`);
    const body = await res.json().catch(() => ({}));
    if (res.ok) setPolls((body.polls as WebinarPollWithOptions[]) ?? []);
  };

  const create = async () => {
    if (!newDraft.question.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/webinars/${webinarId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: newDraft.question.trim(),
          options: newDraft.options,
          status: newDraft.status,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.mode === "unconfigured") {
        setError("Creating polls needs SUPABASE_SERVICE_ROLE_KEY set server-side.");
        return;
      }
      setPolls((prev) => [...prev, body.poll as WebinarPollWithOptions]);
      setNewDraft(EMPTY_DRAFT);
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create poll");
    } finally {
      setBusy(false);
    }
  };

  const save = async (pollId: string) => {
    if (!draft.question.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/webinars/${webinarId}/polls/${pollId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: draft.question.trim(),
          options: draft.options,
          status: draft.status,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save poll");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (poll: WebinarPollWithOptions, status: WebinarPollStatus) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/webinars/${webinarId}/polls/${poll.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setPolls((prev) => prev.map((p) => (p.id === poll.id ? { ...p, status } : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update poll");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (pollId: string) => {
    if (!confirm("Delete this poll and its responses? This can't be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/webinars/${webinarId}/polls/${pollId}`, { method: "DELETE" });
      if (res.ok) setPolls((prev) => prev.filter((p) => p.id !== pollId));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
          Polls {polls.length > 0 ? `(${polls.length})` : ""}
        </div>
        {!adding ? (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setNewDraft(EMPTY_DRAFT);
              setError(null);
            }}
            className="inline-flex items-center gap-1 rounded-pill border border-gray-200 px-2.5 py-1 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <Plus size={12} weight="bold" /> Add poll
          </button>
        ) : null}
      </div>

      {error ? <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-danger">{error}</p> : null}
      {loading ? <p className="text-[12px] text-gray-500">Loading polls…</p> : null}

      {polls.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {polls.map((poll) =>
            editingId === poll.id ? (
              <li key={poll.id} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex flex-col gap-3">
                  <label className={labelCls}>
                    Question
                    <input
                      value={draft.question}
                      onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
                      onKeyDown={(e) => {
                        // This editor lives inside the webinar <form>; don't let
                        // Enter submit that form.
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      className={inputCls}
                    />
                  </label>
                  <label className={labelCls}>
                    Options
                    <OptionsEditor value={draft.options} onChange={(options) => setDraft((d) => ({ ...d, options }))} />
                  </label>
                  <div className="flex items-center gap-3">
                    <label className={labelCls}>
                      Status
                      <select
                        value={draft.status}
                        onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as WebinarPollStatus }))}
                        className={inputCls}
                      >
                        {POLL_STATUSES.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void save(poll.id)}
                        disabled={busy || !draft.question.trim()}
                        className="rounded-pill bg-teal-900 px-3.5 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-40"
                      >
                        {busy ? "Saving…" : "Save poll"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-[12px] font-medium text-gray-500 hover:text-ink"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ) : (
              <li
                key={poll.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-ink">{poll.question}</div>
                  <div className="mt-0.5 text-[12px] text-gray-500">
                    {poll.options.length > 0 ? poll.options.map((o) => o.label).join(" · ") : "No options yet"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    value={poll.status}
                    onChange={(e) => void setStatus(poll, e.target.value as WebinarPollStatus)}
                    disabled={busy}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-700 disabled:opacity-50"
                  >
                    {POLL_STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(poll.id);
                      setDraft({
                        question: poll.question,
                        options: poll.options.map((o) => o.label),
                        status: poll.status,
                      });
                      setError(null);
                    }}
                    className="rounded-pill border border-gray-200 px-2.5 py-1 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(poll.id)}
                    disabled={busy}
                    className="rounded-pill border border-red-200 px-2.5 py-1 text-[12px] font-medium text-danger transition-colors hover:bg-red-50 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      ) : !loading && !adding ? (
        <p className="text-[12px] text-gray-500">
          No polls yet. Add one, set it to Published, and it appears on the webinar&apos;s live page.
        </p>
      ) : null}

      {adding ? (
        <div className="mt-2 rounded-xl border border-dashed border-gray-300 bg-white p-3">
          <div className="flex flex-col gap-3">
            <label className={labelCls}>
              Question
              <input
                autoFocus
                value={newDraft.question}
                onChange={(e) => setNewDraft((d) => ({ ...d, question: e.target.value }))}
                onKeyDown={(e) => {
                  // This editor lives inside the webinar <form>; don't let Enter
                  // submit that form.
                  if (e.key === "Enter") e.preventDefault();
                }}
                placeholder="e.g. Which ESG framework is your team prioritising?"
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              Options
              <OptionsEditor value={newDraft.options} onChange={(options) => setNewDraft((d) => ({ ...d, options }))} />
            </label>
            <div className="flex items-center gap-3">
              <label className={labelCls}>
                Status
                <select
                  value={newDraft.status}
                  onChange={(e) => setNewDraft((d) => ({ ...d, status: e.target.value as WebinarPollStatus }))}
                  className={inputCls}
                >
                  {POLL_STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void create()}
                  disabled={busy || !newDraft.question.trim()}
                  className="rounded-pill bg-teal-900 px-3.5 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-40"
                >
                  {busy ? "Adding…" : "Add poll"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setNewDraft(EMPTY_DRAFT);
                  }}
                  className="text-[12px] font-medium text-gray-500 hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
