"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatCircle, ClockCounterClockwise, Files, Sparkle, X } from "@phosphor-icons/react";
import { clsx } from "clsx";
import { MobileDrawer } from "@/components/mobile-drawer";
import { RecentsRail } from "@/components/ai-hub/RecentsRail";
import type { Conversation } from "@/lib/chat/types";

const TABS = [
  { label: "Chat", href: "/ai-hub/chat", icon: ChatCircle },
  { label: "Artifacts", href: "/ai-hub/artifacts", icon: Files },
] as const;

/**
 * Persistent Chat · Artifacts segmented control. Lives in the WorkspaceFrame
 * toolbar (rendered by ai-hub/layout.tsx), so it stays mounted as you move
 * between the surfaces. Cowork is hidden for launch — its routes still resolve,
 * it just has no tab.
 *
 * Below lg the chat Recents rail is hidden (chat/layout.tsx), so the toolbar
 * also carries the only way into past conversations: a history button opening
 * the conversation list in a drawer.
 */
export function WorkspaceTopToggle({ conversations }: { conversations: Conversation[] }) {
  const pathname = usePathname();
  const [historyOpen, setHistoryOpen] = useState(false);

  // Tapping a conversation navigates; the route change is the close signal.
  useEffect(() => {
    setHistoryOpen(false);
  }, [pathname]);

  return (
    <>
      <span className="mr-1 hidden items-center gap-1.5 text-[13px] font-semibold text-ink sm:flex">
        <span className="grid size-6 place-items-center rounded-lg bg-teal-900 text-green-500">
          <Sparkle size={14} weight="fill" />
        </span>
        AI Hub
      </span>
      <div className="inline-flex items-center gap-1 rounded-pill bg-gray-100 p-1">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                "flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                active ? "bg-teal-900 text-white" : "text-gray-600 hover:bg-white hover:text-ink"
              )}
            >
              <tab.icon size={15} weight={active ? "fill" : "regular"} />
              {tab.label}
            </Link>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setHistoryOpen(true)}
        aria-label="Chat history"
        aria-expanded={historyOpen}
        className="ml-auto grid size-8 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-ink lg:hidden"
      >
        <ClockCounterClockwise size={18} />
      </button>
      {historyOpen && (
        <MobileDrawer label="Chat history" onClose={() => setHistoryOpen(false)} panelClassName="bg-white">
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 py-2 pl-4 pr-2">
            <span className="text-[13px] font-semibold text-ink">Chat history</span>
            <button
              type="button"
              onClick={() => setHistoryOpen(false)}
              aria-label="Close"
              className="grid size-8 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100"
            >
              <X size={16} />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <RecentsRail conversations={conversations} />
          </div>
        </MobileDrawer>
      )}
    </>
  );
}
