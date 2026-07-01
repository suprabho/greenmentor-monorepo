"use client";

import { use, useState } from "react";
import { clsx } from "clsx";
import { List, X } from "@phosphor-icons/react";
import { useEngagementSnapshot } from "@/components/ai-hub/useEngagementSnapshot";
import { EngagementRail } from "@/components/ai-hub/EngagementRail";
import { EngagementConversation } from "@/components/ai-hub/EngagementConversation";
import { ProgressPanel } from "@/components/ai-hub/ProgressPanel";

export default function CoworkEngagementPage({ params }: { params: Promise<{ engagementId: string }> }) {
  const { engagementId } = use(params);
  const { snap, states, busy, progress, error, tick, runPhase, gate, reload } = useEngagementSnapshot(engagementId);
  const [mobileView, setMobileView] = useState<"chat" | "progress">("chat");
  const [railOpen, setRailOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      {/* Header strip: client · FY · frameworks + report + mobile controls */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
        <button
          onClick={() => setRailOpen(true)}
          className="grid size-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden"
          aria-label="Open engagements"
        >
          <List size={18} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink">{snap?.engagement.client_name ?? "Loading…"}</div>
          {snap && (
            <div className="truncate text-[11.5px] text-gray-500">
              {snap.engagement.financial_year} · {(snap.engagement.framework ?? []).join(", ")} · BRSR engagement
            </div>
          )}
        </div>

        {snap && (
          <a
            href={`/api/ai-hub/engagements/${engagementId}/report`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-pill bg-teal-900 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-teal-800 sm:inline-block"
          >
            View report
          </a>
        )}

        <div className="inline-flex items-center gap-1 rounded-pill bg-gray-100 p-0.5 lg:hidden">
          {(["chat", "progress"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setMobileView(v)}
              className={clsx(
                "rounded-pill px-2.5 py-1 text-[12px] font-semibold capitalize transition-colors",
                mobileView === v ? "bg-white text-ink shadow-soft" : "text-gray-500"
              )}
            >
              {v === "chat" ? "Chat" : "Progress"}
            </button>
          ))}
        </div>
      </div>

      {error && !snap && <p className="p-4 text-[13px] text-danger">{error}</p>}

      {/* Body: rail · conversation · progress */}
      <div className="min-h-0 flex-1 lg:flex">
        <div className="hidden w-[260px] shrink-0 border-r border-gray-200 lg:block">
          <EngagementRail activeId={engagementId} />
        </div>

        <div className={clsx("h-full min-w-0 flex-1", mobileView === "chat" ? "block" : "hidden", "lg:block")}>
          <EngagementConversation engagementId={engagementId} onChange={reload} />
        </div>

        <div
          className={clsx(
            "h-full w-full shrink-0 border-l border-gray-200 lg:w-[360px]",
            mobileView === "progress" ? "block" : "hidden",
            "lg:block"
          )}
        >
          {snap ? (
            <ProgressPanel
              engagementId={engagementId}
              snap={snap}
              states={states}
              busy={busy}
              progress={progress}
              tick={tick}
              runPhase={runPhase}
              gate={gate}
              reload={reload}
            />
          ) : (
            <div className="p-4 text-[13px] text-gray-500">Loading…</div>
          )}
        </div>
      </div>

      {/* Mobile engagements drawer */}
      {railOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setRailOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-lift">
            <div className="flex h-full flex-col bg-white">
              <button
                onClick={() => setRailOpen(false)}
                className="absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X size={16} />
              </button>
              <EngagementRail activeId={engagementId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
