"use client";

import { useCallback, useEffect, useState } from "react";
import { Chip } from "@/components/ui";

interface OpenQuestion { id: string; question: string; answer: string | null; waived: boolean; status: string }

/**
 * Kickoff scope questions, surfaced inside the Report Copilot column (they used to
 * live in the right-hand ProgressPanel). Users can resolve them with the structured
 * Answer / Waive controls here, OR just type their answers to the Copilot — the chat
 * has an `answerScopeQuestion` tool that resolves the same rows. Either path bumps the
 * board's refresh, so this card and the pipeline stay in lockstep.
 *
 * Talks to /api/ai-hub/engagements/[id]/reviews (openQuestions + rerun-kickoff).
 */
export function ScopeQuestions({
  engagementId, refreshKey, onChange,
}: { engagementId: string; refreshKey: number; onChange: () => void }) {
  const [questions, setQuestions] = useState<OpenQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/ai-hub/engagements/${engagementId}/reviews`);
      const j = await r.json();
      if (r.ok) setQuestions(j.openQuestions ?? []);
    } catch {
      /* transient — the card just stays as-is until the next refresh */
    }
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

  if (questions.length === 0) return null;
  const openQ = questions.filter((q) => !q.waived && !q.answer).length;

  return (
    <div className="mx-3 mt-3 max-h-[42vh] shrink-0 space-y-3 overflow-y-auto rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5">
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
      <p className="text-[12px] leading-relaxed text-gray-500">
        Answer below, or just tell me the answers in chat and I&apos;ll fill them in.
      </p>
      {questions.map((q) => (
        <div key={q.id} className="rounded-xl border border-amber-100 bg-white p-3">
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
      {error && <p className="rounded-[10px] bg-red-50 px-3 py-2 text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}
