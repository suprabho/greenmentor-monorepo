"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PhaseKey, PhaseStatus } from "@/lib/engagement-ui";

export interface SnapshotPhase {
  phase_key: PhaseKey;
  phase_no: number;
  status: PhaseStatus;
}
export interface SnapshotArtifact {
  artifact_type: string;
  payload: unknown;
  status: string;
  version: number;
  confidence: string | number | null;
}
export interface EngagementSnapshot {
  engagement: { id: string; client_name: string; financial_year: string; framework: string[]; status: string };
  phases: SnapshotPhase[];
  artifactByPhase: Partial<Record<PhaseKey, SnapshotArtifact>>;
}

/**
 * The engagement board's data + mutations, lifted verbatim out of the old
 * ai-hub/engagements/[id]/page.tsx so the Cowork ProgressPanel and the copilot's
 * board-refresh both share one source of truth. `reload` is stable so wiring it
 * to the conversation's onChange won't cause a refetch storm.
 */
export function useEngagementSnapshot(engagementId: string) {
  const [snap, setSnap] = useState<EngagementSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<PhaseKey | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  // Holds the in-flight run-phase request so Stop can abort the local stream
  // immediately (the server run is stopped separately via stopPhase).
  const runAbort = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai-hub/engagements/${engagementId}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setSnap(json.snapshot);
      setTick((t) => t + 1);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }, [engagementId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const states = (snap?.phases ?? []).reduce((acc, p) => {
    acc[p.phase_key] = p.status;
    return acc;
  }, {} as Record<PhaseKey, PhaseStatus>);

  const runPhase = useCallback(
    async (phaseKey: PhaseKey) => {
      setBusy(phaseKey);
      setError(null);
      setProgress("Starting…");
      const abort = new AbortController();
      runAbort.current = abort;
      try {
        const res = await fetch(`/api/ai-hub/engagements/${engagementId}/run-phase`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phaseKey }),
          signal: abort.signal,
        });

        // Auth/validation failures still come back as a plain JSON body, not a stream.
        const ct = res.headers.get("content-type") ?? "";
        if (!res.ok || !res.body || !ct.includes("ndjson")) {
          const json = await res.json().catch(() => ({} as { error?: string }));
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }

        // Consume the NDJSON stream: one JSON object per line.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let sawDone = false;
        let streamError: string | null = null;

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            let ev: { type?: string; note?: string; error?: string };
            try {
              ev = JSON.parse(line);
            } catch {
              continue; // ignore a partial/garbled frame
            }
            if (ev.type === "progress" && ev.note) setProgress(ev.note);
            else if (ev.type === "done") sawDone = true;
            else if (ev.type === "error") streamError = ev.error ?? "Phase run failed.";
          }
        }

        if (streamError) throw new Error(streamError);
        if (!sawDone) {
          // Stream ended without a terminal frame — the function was almost certainly
          // cut at its time limit. Reflect the real DB status and hint at recovery.
          await reload();
          throw new Error(
            "The phase run was interrupted before finishing (server time limit). Refresh in a moment — if it's still marked running, re-run it."
          );
        }
        await reload();
      } catch (e) {
        // A user-initiated Stop aborts the fetch — expected, not an error. stopPhase
        // has already flipped the phase to `failed` server-side and reloaded.
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(String(e instanceof Error ? e.message : e));
      } finally {
        if (runAbort.current === abort) runAbort.current = null;
        setBusy(null);
        setProgress(null);
      }
    },
    [engagementId, reload]
  );

  // Stop a phase that's mid-run (or stuck in agent_running after a reload): abort the
  // local stream, then flip it off agent_running server-side so it becomes runnable.
  const stopPhase = useCallback(
    async (phaseKey: PhaseKey) => {
      runAbort.current?.abort();
      setError(null);
      try {
        const res = await fetch(`/api/ai-hub/engagements/${engagementId}/stop-phase`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phaseKey }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        await reload();
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
      } finally {
        setBusy(null);
        setProgress(null);
      }
    },
    [engagementId, reload]
  );

  const gate = useCallback(
    async (phaseKey: PhaseKey, decision: "approve" | "request-changes") => {
      setBusy(phaseKey);
      setError(null);
      try {
        const res = await fetch(`/api/ai-hub/engagements/${engagementId}/gate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phaseKey, decision }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        await reload();
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
      } finally {
        setBusy(null);
      }
    },
    [engagementId, reload]
  );

  return { snap, states, busy, progress, error, tick, runPhase, stopPhase, gate, reload };
}
