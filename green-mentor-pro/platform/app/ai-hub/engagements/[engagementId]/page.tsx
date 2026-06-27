"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, Chip, PageHeader } from "@/components/ui";
import {
  PHASE_ORDER, PHASE_LABEL, STATUS_TONE, isRunnable,
  type PhaseKey, type PhaseStatus,
} from "@/lib/engagement-ui";
import { ReviewsPanel } from "./ReviewsPanel";

interface Phase { phase_key: PhaseKey; phase_no: number; status: PhaseStatus }
interface Artifact { artifact_type: string; payload: unknown; status: string; version: number; confidence: string | null }
interface Snapshot {
  engagement: { id: string; client_name: string; financial_year: string; framework: string[]; status: string };
  phases: Phase[];
  artifactByPhase: Partial<Record<PhaseKey, Artifact>>;
}

export default function EngagementBoard({ params }: { params: Promise<{ engagementId: string }> }) {
  const { engagementId } = use(params);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<PhaseKey | null>(null);
  const [open, setOpen] = useState<PhaseKey | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/ai-hub/engagements/${engagementId}`);
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? `HTTP ${res.status}`); return; }
    setSnap(json.snapshot);
    setTick((t) => t + 1);
  }, [engagementId]);

  useEffect(() => { load(); }, [load]);

  const states = (snap?.phases ?? []).reduce((acc, p) => { acc[p.phase_key] = p.status; return acc; }, {} as Record<PhaseKey, PhaseStatus>);

  async function runPhase(phaseKey: PhaseKey) {
    setBusy(phaseKey); setError(null);
    try {
      const res = await fetch(`/api/ai-hub/engagements/${engagementId}/run-phase`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phaseKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      await load();
    } catch (e) { setError(String(e instanceof Error ? e.message : e)); }
    finally { setBusy(null); }
  }

  async function gate(phaseKey: PhaseKey, decision: "approve" | "request-changes") {
    setBusy(phaseKey); setError(null);
    try {
      const res = await fetch(`/api/ai-hub/engagements/${engagementId}/gate`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phaseKey, decision }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      await load();
    } catch (e) { setError(String(e instanceof Error ? e.message : e)); }
    finally { setBusy(null); }
  }

  if (!snap) return <p className="px-1 py-6 text-[13px] text-gray-500">{error ?? "Loading…"}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={snap.engagement.client_name}
        sub={`${snap.engagement.financial_year} · ${(snap.engagement.framework ?? []).join(", ")} · BRSR engagement`}
        action={<Link href="/ai-hub/engagements" className="text-[13px] font-semibold text-teal-700 hover:text-teal-900">← All engagements</Link>}
      />

      {error && <p className="rounded-[10px] bg-red-50 px-3 py-2 text-[12.5px] text-danger">{error}</p>}

      <div className="space-y-2.5">
        {PHASE_ORDER.map((pk, i) => {
          const status = states[pk] ?? "not_started";
          const tone = STATUS_TONE[status];
          const runnable = isRunnable(pk, states);
          const running = busy === pk || status === "agent_running";
          const artifact = snap.artifactByPhase[pk];
          return (
            <Card key={pk} className="p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gray-100 text-[12px] font-semibold text-gray-600">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-semibold text-ink">{PHASE_LABEL[pk]}</div>
                </div>
                <Chip tone={tone.tone}>{running && busy === pk ? "Running…" : tone.label}</Chip>

                {runnable && (
                  <button
                    onClick={() => runPhase(pk)}
                    disabled={busy !== null}
                    className="rounded-pill bg-green-700 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-green-700/90 disabled:opacity-50"
                  >
                    {busy === pk ? "Running…" : status === "changes_requested" || status === "failed" ? "Re-run" : "Run"}
                  </button>
                )}
                {status === "awaiting_human_review" && (
                  <div className="flex gap-2">
                    <button onClick={() => gate(pk, "approve")} disabled={busy !== null}
                      className="rounded-pill bg-teal-900 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-teal-800 disabled:opacity-50">Approve</button>
                    <button onClick={() => gate(pk, "request-changes")} disabled={busy !== null}
                      className="rounded-pill border border-gray-200 px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Changes</button>
                  </div>
                )}
                {artifact && (
                  <button onClick={() => setOpen(open === pk ? null : pk)}
                    className="text-[12.5px] font-semibold text-teal-700 hover:text-teal-900">{open === pk ? "Hide" : "Artifact"}</button>
                )}
              </div>

              {open === pk && artifact && (
                <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-ink p-3 font-mono text-[11.5px] leading-relaxed text-green-100">
                  {JSON.stringify(artifact.payload, null, 2)}
                </pre>
              )}
            </Card>
          );
        })}
      </div>

      <ReviewsPanel engagementId={engagementId} refreshKey={tick} onChange={load} />
    </div>
  );
}
