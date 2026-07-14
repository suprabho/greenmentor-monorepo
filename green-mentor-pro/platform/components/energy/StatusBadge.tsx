"use client";

import { Chip } from "@/components/ui";
import type { EntryStatus } from "@/lib/energy/types";

const TONE: Record<EntryStatus, "neutral" | "green" | "teal" | "warn" | "danger"> = {
  Draft: "neutral",
  Submitted: "warn",
  Accepted: "green",
  Rejected: "danger",
};

export function StatusBadge({ status, comment }: { status: EntryStatus; comment?: string | null }) {
  return (
    <span title={status === "Rejected" && comment ? comment : undefined}>
      <Chip tone={TONE[status]}>{status}</Chip>
    </span>
  );
}
