"use client";

/**
 * Pipeline-tab panel for the feed workers (the scheduled GitHub Actions).
 * Shows each worker's last run and lets the operator fire one — or all — on
 * demand via /api/pipeline/workers. A light-theme port of vismay's
 * `components/footshorts/WorkersPanel`, styled in the GreenMentor design
 * system; feedback is inline (no toasts).
 */

import { useCallback, useEffect, useState } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui";

interface LastRun {
  status: string | null;
  conclusion: string | null;
  createdAt: string | null;
  event: string | null;
  url: string | null;
}

interface Worker {
  id: string;
  label: string;
  description: string;
  schedule: string;
  lastRun: LastRun | null;
}

type Mode = "configured" | "unconfigured";
type Status = { type: "idle" | "ok" | "err" | "info"; msg?: string };

function relTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${mins % 60}m ago`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h ago`;
}

/** Colour + label for a run's status/conclusion (status tokens, never bare color). */
function runState(run: LastRun | null): { label: string; cls: string } {
  if (!run) return { label: "no runs", cls: "text-gray-500" };
  if (run.status && run.status !== "completed") {
    return { label: run.status.replace(/_/g, " "), cls: "text-teal-700" };
  }
  switch (run.conclusion) {
    case "success":
      return { label: "success", cls: "text-green-700" };
    case "failure":
      return { label: "failed", cls: "text-danger" };
    case "cancelled":
      return { label: "cancelled", cls: "text-gray-500" };
    default:
      return { label: run.conclusion ?? "unknown", cls: "text-[#B25E00]" };
  }
}

export function WorkersPanel() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ type: "idle" });

  // Pure fetch (no setState) so it's safe to await from the mount effect;
  // callers own the loading flag.
  const fetchWorkers = useCallback(async () => {
    const res = await fetch("/api/pipeline/workers", { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
    return body as { workers?: Worker[]; mode?: Mode };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = await fetchWorkers();
      setWorkers(body.workers ?? []);
      setMode(body.mode ?? "configured");
    } catch (err) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Failed to load workers" });
    } finally {
      setLoading(false);
    }
  }, [fetchWorkers]);

  useEffect(() => {
    let cancelled = false;
    fetchWorkers()
      .then((body) => {
        if (cancelled) return;
        setWorkers(body.workers ?? []);
        setMode(body.mode ?? "configured");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus({ type: "err", msg: err instanceof Error ? err.message : "Failed to load workers" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchWorkers]);

  const trigger = useCallback(
    async (worker: string) => {
      setRunning(worker);
      setStatus({ type: "idle" });
      try {
        const res = await fetch("/api/pipeline/workers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ worker }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        if (body.mode === "unconfigured") {
          setStatus({
            type: "info",
            msg: "Dispatch not configured — set GITHUB_DISPATCH_TOKEN / GITHUB_DISPATCH_REPO, or run pnpm --filter @gm/platform feed:ingest locally.",
          });
          return;
        }
        const results: { id: string; ok: boolean }[] = body.results ?? [];
        const failed = results.filter((r) => !r.ok);
        if (failed.length > 0) {
          setStatus({
            type: "err",
            msg: `Dispatched ${results.length - failed.length}/${results.length} — failed: ${failed.map((f) => f.id).join(", ")}`,
          });
        } else {
          const what = worker === "all" ? `all ${results.length} worker${results.length === 1 ? "" : "s"}` : worker;
          setStatus({ type: "ok", msg: `Triggered ${what} — runs appear on GitHub Actions shortly.` });
        }
        // Re-read after a beat so the "last run" reflects the new dispatch.
        setTimeout(() => void load(), 2500);
      } catch (err) {
        setStatus({ type: "err", msg: err instanceof Error ? err.message : "Dispatch failed" });
      } finally {
        setRunning(null);
      }
    },
    [load]
  );

  const busy = running !== null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Workers</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || busy}
            className="rounded-pill border border-gray-200 bg-white px-3 py-1 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => void trigger("all")}
            disabled={busy}
            className="rounded-pill bg-teal-900 px-3 py-1 text-[12px] font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-40"
          >
            {running === "all" ? "Triggering…" : "Trigger all"}
          </button>
        </div>
      </div>

      {mode === "unconfigured" ? (
        <p className="mb-2 rounded-lg bg-[#FFF4E0] px-3 py-2 text-[12px] text-[#B25E00]">
          Dispatch not configured — last-run data and triggering need GITHUB_DISPATCH_TOKEN /
          GITHUB_DISPATCH_REPO. Worker list shown for reference.
        </p>
      ) : null}

      {status.type !== "idle" ? (
        <div
          className={`mb-2 rounded-lg px-3 py-2 text-[12px] ${
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

      <Card className="divide-y divide-gray-100">
        {workers.map((w) => {
          const rs = runState(w.lastRun);
          return (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[14px] font-semibold text-ink">{w.label}</span>
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                    {w.schedule}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[12.5px] text-gray-600">{w.description}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
                  <span className={`font-semibold ${rs.cls}`}>{rs.label}</span>
                  <span className="text-gray-300">·</span>
                  <span className="whitespace-nowrap text-gray-600">{relTime(w.lastRun?.createdAt ?? null)}</span>
                  {w.lastRun?.event ? (
                    <span className="text-gray-500">· {w.lastRun.event.replace(/_/g, " ")}</span>
                  ) : null}
                  {w.lastRun?.url ? (
                    <a
                      href={w.lastRun.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-0.5 font-medium text-teal-700 hover:underline"
                    >
                      view <ArrowSquareOut size={12} />
                    </a>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void trigger(w.id)}
                disabled={busy}
                className="shrink-0 rounded-pill border border-gray-200 bg-white px-3 py-1 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
              >
                {running === w.id ? "Triggering…" : "Trigger"}
              </button>
            </div>
          );
        })}
        {!loading && workers.length === 0 ? (
          <p className="p-5 text-[13px] text-gray-500">No workers found.</p>
        ) : null}
        {loading && workers.length === 0 ? (
          <p className="p-5 text-[13px] text-gray-500">Loading workers…</p>
        ) : null}
      </Card>
    </div>
  );
}
