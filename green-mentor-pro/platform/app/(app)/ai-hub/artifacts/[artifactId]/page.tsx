"use client";

import { use, useEffect, useState } from "react";
import { ArtifactDetail } from "@/components/ai-hub/ArtifactDetail";
import type { ArtifactRow } from "@/lib/artifact-ui";

export default function ArtifactDetailPage({ params }: { params: Promise<{ artifactId: string }> }) {
  const { artifactId } = use(params);
  const [artifact, setArtifact] = useState<ArtifactRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/ai-hub/artifacts?artifactId=${artifactId}`)
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(j.error))))
      .then((j) => setArtifact((j.artifacts ?? [])[0] ?? null))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [artifactId]);

  return (
    <div className="h-full overflow-y-auto px-4 py-8 lg:px-8">
      {loading ? (
        <p className="text-[13px] text-gray-500">Loading…</p>
      ) : error ? (
        <p className="text-[13px] text-danger">{error}</p>
      ) : artifact ? (
        <ArtifactDetail a={artifact} />
      ) : (
        <p className="text-[13px] text-gray-500">Artifact not found.</p>
      )}
    </div>
  );
}
