"use client";

import { useState } from "react";
import { Chip, ProgressBar } from "@/components/ui";
import {
  PHASE_ORDER,
  PHASE_LABEL,
  STATUS_TONE,
  isRunnable,
  type PhaseKey,
  type PhaseStatus,
} from "@/lib/engagement-ui";
import { ReviewsPanel } from "./ReviewsPanel";
import type { EngagementSnapshot } from "./useEngagementSnapshot";

/**
 * Right column of the Cowork engagement view. Mirrors Claude's "Progress" panel:
 * a completion bar over the 8-phase pipeline (from lib/engagement-ui), each phase
 * with Run / Approve / Changes actions and an artifact peek, and the ReviewsPanel
 * (data-row gates) folded in below. Kickoff scope questions moved to the Copilot
 * column (see ScopeQuestions).
 */
export function ProgressPanel({
  engagementId,
  snap,
  states,
  busy,
  progress,
  tick,
  runPhase,
  stopPhase,
  gate,
  reload,
}: {
  engagementId: string;
  snap: EngagementSnapshot;
  states: Record<PhaseKey, PhaseStatus>;
  busy: PhaseKey | null;
  progress?: string | null;
  tick: number;
  runPhase: (pk: PhaseKey) => void;
  stopPhase: (pk: PhaseKey) => void;
  gate: (pk: PhaseKey, decision: "approve" | "request-changes") => void;
  reload: () => void;
}) {
  const [open, setOpen] = useState<PhaseKey | null>(null);
  const [stopping, setStopping] = useState<PhaseKey | null>(null);
  const completed = PHASE_ORDER.filter((pk) => states[pk] === "complete").length;

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="shrink-0 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[13.5px] font-semibold text-ink">Progress</span>
          <span className="text-[12px] font-semibold text-gray-500">{completed} of {PHASE_ORDER.length}</span>
        </div>
        <ProgressBar value={(completed / PHASE_ORDER.length) * 100} className="mt-2" />
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="space-y-2">
          {PHASE_ORDER.map((pk, i) => {
            const status = states[pk] ?? "not_started";
            const tone = STATUS_TONE[status];
            const runnable = isRunnable(pk, states);
            const artifact = snap.artifactByPhase[pk];
            const isBusy = busy === pk || status === "agent_running";
            return (
              <div key={pk} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{PHASE_LABEL[pk]}</span>
                  <Chip tone={tone.tone}>{isBusy && busy === pk ? "Running…" : tone.label}</Chip>
                </div>

                {busy === pk && progress && (
                  <div className="mt-2 flex items-center gap-2 pl-[34px] text-[11.5px] text-gray-500">
                    <span className="size-1.5 animate-pulse rounded-full bg-green-600" />
                    <span className="truncate">{progress}</span>
                  </div>
                )}

                {(runnable || status === "awaiting_human_review" || artifact || isBusy) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-[34px]">
                    {runnable && (
                      <button
                        onClick={() => runPhase(pk)}
                        disabled={busy !== null}
                        className="rounded-pill bg-green-700 px-3 py-1 text-[12px] font-semibold text-white hover:bg-green-700/90 disabled:opacity-50"
                      >
                        {busy === pk ? "Running…" : status === "changes_requested" || status === "failed" ? "Re-run" : "Run"}
                      </button>
                    )}
                    {isBusy && (
                      <button
                        onClick={async () => {
                          setStopping(pk);
                          try {
                            await stopPhase(pk);
                          } finally {
                            setStopping(null);
                          }
                        }}
                        disabled={stopping === pk}
                        title="Stop this run and free the phase to re-run"
                        className="rounded-pill border border-red-300 px-3 py-1 text-[12px] font-semibold text-red-600 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                      >
                        {stopping === pk ? "Stopping…" : "■ Stop"}
                      </button>
                    )}
                    {status === "awaiting_human_review" && (
                      <>
                        <button
                          onClick={() => gate(pk, "approve")}
                          disabled={busy !== null}
                          className="rounded-pill bg-teal-900 px-3 py-1 text-[12px] font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => gate(pk, "request-changes")}
                          disabled={busy !== null}
                          className="rounded-pill border border-gray-200 px-3 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Changes
                        </button>
                      </>
                    )}
                    {artifact && (
                      <button
                        onClick={() => setOpen(open === pk ? null : pk)}
                        className="text-[12px] font-semibold text-teal-700 hover:text-teal-900"
                      >
                        {open === pk ? "Hide" : "Artifact"}
                      </button>
                    )}
                  </div>
                )}

                {open === pk && artifact && (
                  <pre className="mt-2.5 max-h-72 overflow-auto rounded-lg bg-ink p-3 font-mono text-[11px] leading-relaxed text-green-100">
                    {JSON.stringify(artifact.payload, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>

        <ReviewsPanel engagementId={engagementId} refreshKey={tick} onChange={reload} />
      </div>
    </div>
  );
}
