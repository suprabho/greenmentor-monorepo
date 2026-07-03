"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Chip } from "@/components/ui";

interface FieldReview { id: string; item: string; ai_value: unknown; confidence: string | null; status: string }

// Data-row review surface for an engagement (data-collection field gates). The
// kickoff scope questions now live in the Report Copilot column (see ScopeQuestions);
// this panel handles only field rows. Talks to /api/ai-hub/engagements/[id]/reviews.
export function ReviewsPanel({
  engagementId, refreshKey, onChange,
}: { engagementId: string; refreshKey: number; onChange: () => void }) {
  const [fields, setFields] = useState<FieldReview[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/ai-hub/engagements/${engagementId}/reviews`);
    const j = await r.json();
    if (r.ok) setFields(j.fieldReviews ?? []);
  }, [engagementId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  async function post(body: unknown) {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/ai-hub/engagements/${engagementId}/reviews`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      await load(); onChange();
    } catch (e) { setError(String(e instanceof Error ? e.message : e)); }
    finally { setBusy(false); }
  }

  if (fields.length === 0) return null;
  const openF = fields.filter((f) => f.status === "submitted").length;

  return (
    <Card className="space-y-4 p-4">
      {fields.length > 0 && (
        <div className="space-y-2">
          <Chip tone="warn">Data rows · {openF} to review</Chip>
          {fields.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-xl border border-gray-100 p-2.5">
              <div className="min-w-0 flex-1 text-[12.5px] text-gray-700">
                <span className="font-medium text-ink">{f.item}</span>{" "}
                <span className="font-mono text-[11.5px] text-gray-500">{JSON.stringify(f.ai_value)}</span>
              </div>
              {f.confidence && <Chip>{f.confidence}</Chip>}
              {f.status === "submitted" ? (
                <div className="flex gap-1.5">
                  <button disabled={busy} onClick={() => post({ kind: "field", reviewId: f.id, decision: "approved" })}
                    className="rounded-pill bg-green-700 px-2.5 py-1 text-[12px] font-semibold text-white disabled:opacity-40">✓</button>
                  <button disabled={busy} onClick={() => post({ kind: "field", reviewId: f.id, decision: "rejected" })}
                    className="rounded-pill border border-gray-200 px-2.5 py-1 text-[12px] font-semibold text-gray-600 disabled:opacity-40">✗</button>
                </div>
              ) : (
                <Chip tone={f.status === "approved" ? "green" : "danger"}>{f.status}</Chip>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="rounded-[6px] bg-red-50 px-3 py-2 text-[12.5px] text-danger">{error}</p>}
    </Card>
  );
}
