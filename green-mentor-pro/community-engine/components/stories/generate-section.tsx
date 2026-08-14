"use client";

/**
 * Engine-2 "Generate" stage: materialize accepted outline entries into real
 * sections, then run per-section CONTENT+VISUAL generation (up to three in
 * flight — the server CAS-retries concurrent writes) and source-grounded
 * chart data. Every successful action re-fetches the story row so the
 * editor's document panes and preview stay in sync with the server-side
 * writes.
 */

import { useState } from "react";
import { clsx } from "clsx";
import type { ComposeState, StoryRow } from "@/lib/db/stories";

const btnCls =
  "rounded-pill bg-teal-900 px-3.5 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-40";
const ghostBtnCls =
  "rounded-pill border border-gray-200 px-3 py-1 text-[11.5px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40";

export function GenerateSection({
  base,
  storyId,
  compose,
  setCompose,
  onStoryRefreshed,
}: {
  base: string;
  storyId: string;
  compose: ComposeState;
  setCompose: (next: ComposeState) => void;
  onStoryRefreshed?: (row: StoryRow) => void;
}) {
  const [materializing, setMaterializing] = useState(false);
  const [chartsBusy, setChartsBusy] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});

  const accepted = compose.outline.filter((e) => e.accepted);
  const unmaterialized = accepted.filter((e) => !e.sectionId);
  const materialized = compose.outline.filter((e) => e.sectionId);
  const chartCount = Array.isArray(
    (compose.storyOutline as { charts?: unknown[] } | undefined)?.charts
  )
    ? ((compose.storyOutline as { charts: unknown[] }).charts?.length ?? 0)
    : 0;
  const inFlight = Object.values(busy).filter(Boolean).length;

  const refreshStory = async () => {
    try {
      const res = await fetch(`/api/stories/${storyId}`);
      if (!res.ok) return;
      const row = (await res.json()) as StoryRow;
      onStoryRefreshed?.(row);
    } catch {
      // The next manual save/reload catches up.
    }
  };

  const materialize = async () => {
    setMaterializing(true);
    setError(null);
    try {
      const res = await fetch(`${base}/materialize`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        compose_state?: ComposeState;
      };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.compose_state) setCompose(body.compose_state);
      await refreshStory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Materialize failed");
    } finally {
      setMaterializing(false);
    }
  };

  const generateSection = async (entryId: string, feedback?: string) => {
    setBusy((b) => ({ ...b, [entryId]: true }));
    setError(null);
    try {
      const res = await fetch(`${base}/section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, pass: "combined", ...(feedback ? { feedback } : {}) }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setDone((d) => ({ ...d, [entryId]: true }));
      await refreshStory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Section generation failed");
    } finally {
      setBusy((b) => ({ ...b, [entryId]: false }));
    }
  };

  const generateCharts = async () => {
    setChartsBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}/chart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chart generation failed");
    } finally {
      setChartsBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      {error ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-danger">{error}</div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12px] text-gray-500">
          {materialized.length} of {accepted.length} accepted sections materialized
          {chartCount > 0 ? ` · ${chartCount} chart${chartCount === 1 ? "" : "s"} planned` : ""}
        </div>
        <div className="flex items-center gap-2">
          {chartCount > 0 ? (
            <button type="button" onClick={() => void generateCharts()} disabled={chartsBusy} className={ghostBtnCls}>
              {chartsBusy ? "Generating charts…" : `Generate charts (${chartCount})`}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void materialize()}
            disabled={materializing || unmaterialized.length === 0}
            className={btnCls}
          >
            {materializing
              ? "Materializing…"
              : unmaterialized.length > 0
                ? `Materialize ${unmaterialized.length} section${unmaterialized.length === 1 ? "" : "s"}`
                : "All sections materialized"}
          </button>
        </div>
      </div>

      {materialized.length === 0 ? (
        <p className="text-[12.5px] text-gray-500">
          Accept outline sections, then materialize them to unlock per-section generation.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-100">
          {materialized.map((entry) => {
            const isBusy = Boolean(busy[entry.id]);
            return (
              <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-ink">
                    {entry.heading}
                    {done[entry.id] ? (
                      <span className="ml-2 text-[11px] font-medium text-green-700">generated</span>
                    ) : null}
                  </div>
                  <div className="truncate text-[11.5px] text-gray-500">{entry.intent}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className={ghostBtnCls}
                    disabled={isBusy || inFlight >= 3}
                    onClick={() => {
                      const feedback = window.prompt(
                        `Rewrite notes for "${entry.heading}" (optional):`
                      );
                      if (feedback === null) return;
                      void generateSection(entry.id, feedback.trim() || undefined);
                    }}
                  >
                    Rewrite…
                  </button>
                  <button
                    type="button"
                    className={clsx(btnCls, "px-3 py-1 text-[11.5px]")}
                    disabled={isBusy || inFlight >= 3}
                    onClick={() => void generateSection(entry.id)}
                  >
                    {isBusy ? "Generating…" : done[entry.id] ? "Regenerate" : "Generate"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
