"use client";

import Link from "next/link";
import { Chip } from "@/components/ui";
import { WarningCircle } from "@phosphor-icons/react";

export interface Ask {
  engagementId: string;
  clientName: string;
  phaseLabel: string;
}

/** "Active asks" — phases across engagements that are awaiting the user's review. */
export function ActiveAsks({ asks }: { asks: Ask[] }) {
  if (asks.length === 0) return null;
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <WarningCircle size={17} weight="fill" className="text-[#B25E00]" />
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Active asks</h2>
      </div>
      <div className="space-y-2">
        {asks.map((a, i) => (
          <Link
            key={`${a.engagementId}-${i}`}
            href={`/ai-hub/cowork/${a.engagementId}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-[#F3D9A8] bg-[#FFF9EE] px-4 py-3 transition-colors hover:border-[#E9C583]"
          >
            <div className="min-w-0 text-[13.5px] text-ink">
              <span className="font-semibold">{a.clientName}</span>
              <span className="text-gray-500"> — {a.phaseLabel} is awaiting review</span>
            </div>
            <Chip tone="warn">Review</Chip>
          </Link>
        ))}
      </div>
    </section>
  );
}
