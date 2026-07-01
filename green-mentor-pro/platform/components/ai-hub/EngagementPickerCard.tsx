"use client";

import Link from "next/link";
import { Card, Chip, ProgressBar } from "@/components/ui";

export interface PickerEngagement {
  id: string;
  client_name: string;
  financial_year: string;
  framework: string[];
  status: string;
}

/** A single engagement tile on the Cowork landing. */
export function EngagementPickerCard({
  engagement,
  progress,
  awaiting,
}: {
  engagement: PickerEngagement;
  progress: number;
  awaiting: number;
}) {
  return (
    <Link href={`/ai-hub/cowork/${engagement.id}`} className="block">
      <Card className="flex h-full flex-col gap-3 p-4 transition-colors hover:border-gray-300">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-ink">{engagement.client_name}</div>
            <div className="text-[12px] text-gray-500">{engagement.financial_year}</div>
          </div>
          <Chip tone={engagement.status === "active" ? "green" : "neutral"}>{engagement.status}</Chip>
        </div>

        {engagement.framework?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {engagement.framework.map((f) => (
              <Chip key={f} tone="neutral">
                {f}
              </Chip>
            ))}
          </div>
        )}

        <div className="mt-auto space-y-1.5">
          <div className="flex items-center justify-between text-[11.5px] text-gray-500">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <ProgressBar value={progress} />
          {awaiting > 0 && (
            <div className="text-[12px] font-semibold text-[#B25E00]">{awaiting} awaiting your review</div>
          )}
        </div>
      </Card>
    </Link>
  );
}
