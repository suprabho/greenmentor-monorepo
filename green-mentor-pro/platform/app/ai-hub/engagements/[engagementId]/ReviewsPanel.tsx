"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Chip } from "@/components/ui";

interface OpenQuestion { id: string; question: string; answer: string | null; waived: boolean; status: string }
interface FieldReview { id: string; item: string; ai_value: unknown; confidence: string | null; status: string }

export function ReviewsPanel({
  engagementId, refreshKey, onChange,
}: { engagementId: string; refreshKey: number; onChange: () => void }) {
  const [questions, setQuestions] = useState<OpenQuestion[]>([]);
  const [fields, setFields] = useState<FieldReview[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/ai-hub/engagements/${engagementId}/reviews`);
    const j = await r.json();
    if (r.ok) { setQuestions(j.openQuestions ?? []); setFields(j.fieldReviews ?? []); }
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

  if (questions.length === 0 && fields.length === 0) return null;
  const openQ = questions.filter((q) => !q.waived && !q.answer).length;
  const openF = fields.filter((f) => f.status === "submitted").length;

  return (
    <Card className="space-y-4 p-5">
      {questions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Chip tone="warn">Scope questions · {openQ} open</Chip>
            <button
              disabled={busy || openQ > 0}
              onClick={() => post({ kind: "rerun-kickoff" })}
              className="rounded-pill bg-teal-900 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
            >
              Apply & re-run kickoff
            </button>
          </div>
          {questions.map((q) => (
            <div key={q.id} className="rounded-xl border border-gray-100 p-3">
              <div className="text-[13.5px] font-medium text-ink">{q.question}</div>
              {q.answer ? (
                <div className="mt-1 text-[12.5px] text-green-700">✓ {q.answer}</div>
              ) : q.waived ? (
                <div className="mt-1"><Chip>waived</Chip></div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <input
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    placeholder="Answer…"
                    className="flex-1 rounded-[10px] border border-gray-200 bg-gray-50 px-3 py-1.5 text-[12.5px] outline-none focus:border-teal-700"
                  />
                  <button disabled={busy} onClick={() => post({ kind: "question", reviewId: q.id, answer: answers[q.id] })}
                    className="rounded-pill bg-green-700 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40">Answer</button>
                  <button disabled={busy} onClick={() => post({ kind: "question", reviewId: q.id, waived: true })}
                    className="rounded-pill border border-gray-200 px-3 py-1.5 text-[12px] font-semibold text-gray-600 disabled:opacity-40">Waive</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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

      {error && <p className="rounded-[10px] bg-red-50 px-3 py-2 text-[12.5px] text-danger">{error}</p>}
    </Card>
  );
}
