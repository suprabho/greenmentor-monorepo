"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { Card } from "@/components/ui";
import { EngagementPickerCard, type PickerEngagement } from "@/components/ai-hub/EngagementPickerCard";
import { ActiveAsks, type Ask } from "@/components/ai-hub/ActiveAsks";
import { PHASE_LABEL, PHASE_ORDER, type PhaseKey, type PhaseStatus } from "@/lib/engagement-ui";

interface Item {
  engagement: PickerEngagement;
  progress: number;
  awaiting: number;
}

export default function CoworkLanding() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [asks, setAsks] = useState<Ask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [clientName, setClientName] = useState("");
  const [fy, setFy] = useState("FY2025-26");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/ai-hub/engagements");
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        const list: PickerEngagement[] = j.engagements ?? [];

        // Fan out for phase state — the list API doesn't carry progress. Small N.
        const snaps = await Promise.all(
          list.map(async (e) => {
            try {
              const rs = await fetch(`/api/ai-hub/engagements/${e.id}`);
              const js = await rs.json();
              return rs.ok ? js.snapshot : null;
            } catch {
              return null;
            }
          })
        );

        const nextAsks: Ask[] = [];
        const nextItems: Item[] = list.map((e, idx) => {
          const phases: { phase_key: PhaseKey; status: PhaseStatus }[] = snaps[idx]?.phases ?? [];
          const complete = phases.filter((p) => p.status === "complete").length;
          const awaitingPhases = phases.filter((p) => p.status === "awaiting_human_review");
          for (const p of awaitingPhases) {
            nextAsks.push({ engagementId: e.id, clientName: e.client_name, phaseLabel: PHASE_LABEL[p.phase_key] ?? p.phase_key });
          }
          return { engagement: e, progress: (complete / PHASE_ORDER.length) * 100, awaiting: awaitingPhases.length };
        });

        setItems(nextItems);
        setAsks(nextAsks);
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
        setItems([]);
      }
    })();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-hub/engagements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientName, financialYear: fy, framework: ["BRSR"] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      router.push(`/ai-hub/cowork/${json.engagement.id}`);
    } catch (e2) {
      setError(String(e2 instanceof Error ? e2.message : e2));
      setCreating(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <h1 className="font-display text-[26px] text-ink">What&apos;s on your plate today?</h1>
          <p className="mt-1 text-[14px] text-gray-500">Pick up an engagement or start a new BRSR report.</p>
        </header>

        <ActiveAsks asks={asks} />

        <section className="space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Engagements</h2>
          {error && <p className="text-[13px] text-danger">{error}</p>}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items === null ? (
              <p className="text-[13px] text-gray-500">Loading…</p>
            ) : (
              <>
                {items.map((it) => (
                  <EngagementPickerCard
                    key={it.engagement.id}
                    engagement={it.engagement}
                    progress={it.progress}
                    awaiting={it.awaiting}
                  />
                ))}

                <Card className="flex flex-col justify-center p-4">
                  {!showNew ? (
                    <button
                      onClick={() => setShowNew(true)}
                      className="flex h-full min-h-[9rem] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 text-gray-500 transition-colors hover:border-teal-700 hover:text-teal-700"
                    >
                      <Plus size={22} weight="bold" />
                      <span className="text-[13.5px] font-semibold">New engagement</span>
                    </button>
                  ) : (
                    <form onSubmit={create} className="space-y-2">
                      <input
                        required
                        autoFocus
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Client / entity"
                        className="w-full rounded-[10px] border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[12.5px] outline-none focus:border-teal-700"
                      />
                      <input
                        required
                        value={fy}
                        onChange={(e) => setFy(e.target.value)}
                        placeholder="Financial year"
                        className="w-full rounded-[10px] border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[12.5px] outline-none focus:border-teal-700"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={creating}
                          className="flex-1 rounded-pill bg-teal-900 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                        >
                          {creating ? "Creating…" : "Create"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowNew(false)}
                          className="rounded-pill border border-gray-200 px-3 py-1.5 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </Card>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
