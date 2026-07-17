"use client";

/**
 * Live-page polls. Static polls authored in community-engine are shown here;
 * a signed-in attendee picks one option per poll. Writes go directly to
 * webinar_poll_responses through the browser Supabase client under the
 * "own rows" RLS policy — the same direct-write + optimistic pattern as the
 * feed's reactions (app/(app)/feed/feed-actions.tsx). Once answered, the poll
 * flips to aggregate results read from the webinar_poll_results view.
 */

import { useRef, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import type { WebinarPoll } from "@/lib/webinars/repo";

// One browser client for the widget, created lazily so it never runs during SSR.
function useSupabase() {
  const ref = useRef<ReturnType<typeof createClient>>(null);
  return () => (ref.current ??= createClient());
}

export function WebinarPolls({
  polls,
  initialResponses,
  initialResults,
  userId,
}: {
  polls: WebinarPoll[];
  initialResponses: Record<string, string>; // poll_id -> chosen option_id
  initialResults: Record<string, Record<string, number>>; // poll_id -> option_id -> votes
  userId: string;
}) {
  const getSupabase = useSupabase();
  // Local, optimistic copies of the user's answers and the vote tallies.
  const [answers, setAnswers] = useState<Record<string, string>>(initialResponses);
  const [results, setResults] = useState<Record<string, Record<string, number>>>(initialResults);
  const busyRef = useRef(false);

  if (polls.length === 0) {
    return (
      <aside className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">Polls</h2>
        <p className="mt-2 text-[13px] text-gray-500">No polls for this session.</p>
      </aside>
    );
  }

  const vote = async (pollId: string, optionId: string) => {
    if (answers[pollId] || busyRef.current) return; // one answer per poll (MVP)
    busyRef.current = true;

    // Optimistic: record the answer and bump the tally.
    setAnswers((a) => ({ ...a, [pollId]: optionId }));
    setResults((r) => {
      const poll = { ...(r[pollId] ?? {}) };
      poll[optionId] = (poll[optionId] ?? 0) + 1;
      return { ...r, [pollId]: poll };
    });

    const { error } = await getSupabase()
      .from("webinar_poll_responses")
      .upsert({ user_id: userId, poll_id: pollId, option_id: optionId }, { onConflict: "user_id,poll_id" });
    busyRef.current = false;

    if (error) {
      // Roll back both the answer and the tally.
      setAnswers((a) => {
        const next = { ...a };
        delete next[pollId];
        return next;
      });
      setResults((r) => {
        const poll = { ...(r[pollId] ?? {}) };
        poll[optionId] = Math.max(0, (poll[optionId] ?? 1) - 1);
        return { ...r, [pollId]: poll };
      });
    }
  };

  return (
    <aside className="flex flex-col gap-4">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">Polls</h2>
      {polls.map((poll) => {
        const chosen = answers[poll.id];
        const tally = results[poll.id] ?? {};
        const total = Object.values(tally).reduce((sum, n) => sum + n, 0);
        const answered = Boolean(chosen);

        return (
          <div key={poll.id} className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-[13.5px] font-semibold text-ink">{poll.question}</p>
            <div className="mt-3 flex flex-col gap-2">
              {poll.options.map((opt) => {
                const votes = tally[opt.id] ?? 0;
                const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
                const isChoice = chosen === opt.id;

                if (answered) {
                  return (
                    <div key={opt.id} className="relative overflow-hidden rounded-lg border border-gray-200 px-3 py-2">
                      <div
                        className={`absolute inset-y-0 left-0 ${isChoice ? "bg-green-100" : "bg-gray-100"}`}
                        style={{ width: `${pct}%` }}
                        aria-hidden
                      />
                      <div className="relative flex items-center justify-between text-[13px]">
                        <span className={`flex items-center gap-1.5 ${isChoice ? "font-semibold text-green-900" : "text-gray-700"}`}>
                          {isChoice && <CheckCircle size={15} weight="fill" className="text-green-700" />}
                          {opt.label}
                        </span>
                        <span className="tabular-nums text-gray-600">{pct}%</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => void vote(poll.id, opt.id)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-left text-[13px] text-gray-700 transition-colors hover:border-teal-300 hover:bg-teal-50"
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {answered && (
              <p className="mt-2 text-[11.5px] text-gray-400">
                {total} {total === 1 ? "response" : "responses"}
              </p>
            )}
          </div>
        );
      })}
    </aside>
  );
}
