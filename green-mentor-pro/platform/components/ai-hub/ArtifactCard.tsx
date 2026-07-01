"use client";

import Link from "next/link";
import { Card, Chip } from "@/components/ui";
import { PHASE_LABEL } from "@/lib/engagement-ui";
import { artifactLabel, artifactTldr, ARTIFACT_STATUS_TONE, relativeTime, type ArtifactRow } from "@/lib/artifact-ui";

/** A single artifact tile in the gallery. */
export function ArtifactCard({ a }: { a: ArtifactRow }) {
  const tldr = artifactTldr(a.payload);
  return (
    <Link href={`/ai-hub/artifacts/${a.id}`} className="block">
      <Card className="flex h-full flex-col gap-2 p-4 transition-colors hover:border-gray-300">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-green-700">
            {PHASE_LABEL[a.phase_key] ?? a.phase_key}
          </span>
          <Chip tone={ARTIFACT_STATUS_TONE[a.status]}>{a.status}</Chip>
        </div>
        <div className="text-[14.5px] font-semibold text-ink">{artifactLabel(a.artifact_type, a.phase_key)}</div>
        {tldr && <p className="line-clamp-3 text-[12.5px] leading-relaxed text-gray-500">{tldr}</p>}
        <div className="mt-auto text-[11px] text-gray-400">
          v{a.version} · {relativeTime(a.updated_at)}
        </div>
      </Card>
    </Link>
  );
}
