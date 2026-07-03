"use client";

import { useState } from "react";
import Link from "next/link";
import { Chip } from "@/components/ui";
import { PHASE_LABEL } from "@/lib/engagement-ui";
import { artifactLabel, ARTIFACT_STATUS_TONE, relativeTime, type ArtifactRow } from "@/lib/artifact-ui";
import { renderArtifact } from "./artifact-renderers";

/** Full artifact view: metadata header, structured render, raw JSON toggle. */
export function ArtifactDetail({ a }: { a: ArtifactRow }) {
  const [raw, setRaw] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/ai-hub/artifacts" className="text-[13px] font-semibold text-teal-700 hover:text-teal-900">
          ← All artifacts
        </Link>
        <Link
          href={`/ai-hub/cowork/${a.engagement_id}`}
          className="rounded-pill bg-teal-900 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-teal-800"
        >
          Open in engagement
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-green-700">
            {PHASE_LABEL[a.phase_key] ?? a.phase_key}
          </span>
          <Chip tone={ARTIFACT_STATUS_TONE[a.status]}>{a.status}</Chip>
          <span className="text-[11.5px] text-gray-400">
            v{a.version} · {relativeTime(a.updated_at)}
            {a.confidence != null ? ` · confidence ${Math.round(a.confidence * 100)}%` : ""}
          </span>
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">{artifactLabel(a.artifact_type, a.phase_key)}</h1>
        <p className="text-[13.5px] text-gray-500">{a.client_name}</p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setRaw((v) => !v)}
          className="text-[12.5px] font-semibold text-teal-700 hover:text-teal-900"
        >
          {raw ? "Formatted view" : "Raw JSON"}
        </button>
      </div>

      <div className="rounded-[10px] border border-gray-200 bg-white p-5 shadow-soft">
        {raw ? (
          <pre className="max-h-[32rem] overflow-auto rounded-xl bg-ink p-4 font-mono text-[11.5px] leading-relaxed text-green-100">
            {JSON.stringify(a.payload, null, 2)}
          </pre>
        ) : (
          renderArtifact(a.artifact_type, a.phase_key, a.payload)
        )}
      </div>
    </div>
  );
}
