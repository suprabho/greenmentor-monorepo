"use client";

import { useEffect, useState } from "react";
import { ArtifactCard } from "@/components/ai-hub/ArtifactCard";
import type { ArtifactRow } from "@/lib/artifact-ui";

interface Group {
  engagementId: string;
  clientName: string;
  artifacts: ArtifactRow[];
}

export default function ArtifactsGallery() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ai-hub/artifacts")
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(j.error))))
      .then((j) => {
        const artifacts: ArtifactRow[] = j.artifacts ?? [];
        // Group by engagement, preserving updated_at ordering from the API.
        const byEngagement = new Map<string, Group>();
        for (const a of artifacts) {
          let g = byEngagement.get(a.engagement_id);
          if (!g) {
            g = { engagementId: a.engagement_id, clientName: a.client_name, artifacts: [] };
            byEngagement.set(a.engagement_id, g);
          }
          g.artifacts.push(a);
        }
        setGroups([...byEngagement.values()]);
      })
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="h-full overflow-y-auto px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <h1 className="font-display text-[26px] text-ink">Artifacts</h1>
          <p className="mt-1 text-[14px] text-gray-500">Every output your engagements have produced, grouped by client.</p>
        </header>

        {error && <p className="text-[13px] text-danger">{error}</p>}

        {groups === null ? (
          <p className="text-[13px] text-gray-500">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="text-[13px] text-gray-500">
            No artifacts yet — run a phase in an engagement and its output will appear here.
          </p>
        ) : (
          groups.map((g) => (
            <section key={g.engagementId} className="space-y-3">
              <h2 className="text-[15px] font-semibold text-ink">{g.clientName}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.artifacts.map((a) => (
                  <ArtifactCard key={a.id} a={a} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
