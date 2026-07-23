"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatCircle, Files, Sparkle } from "@phosphor-icons/react";
import { clsx } from "clsx";

const TABS = [
  { label: "Chat", href: "/ai-hub/chat", icon: ChatCircle },
  { label: "Artifacts", href: "/ai-hub/artifacts", icon: Files },
] as const;

/**
 * Persistent Chat · Artifacts segmented control. Lives in the WorkspaceFrame
 * toolbar (rendered by ai-hub/layout.tsx), so it stays mounted as you move
 * between the surfaces. Cowork is hidden for launch — its routes still resolve,
 * it just has no tab.
 */
export function WorkspaceTopToggle() {
  const pathname = usePathname();
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
    </>
  );
}
