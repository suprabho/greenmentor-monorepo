"use client";

/**
 * Zoom polls sub-section, rendered inside a webinar's expanded row under the
 * People section. Live polls run on Zoom (the host launches them from the
 * Zoom client; attendees answer inside the embedded player), so all this
 * section does is pull the results afterwards and show them:
 *
 *   Sync from Zoom — POST /api/webinars/[id]/zoom-polls, which reads Zoom's
 *   past-meeting poll report. Zoom only exposes it after the meeting ends,
 *   usually within a few minutes.
 *
 * Answers render as per-question tallies with the individual responses
 * behind a disclosure, and export to CSV in the browser like the People
 * lists. Lives inside the webinar <form> in webinars-panel, so every control
 * is type="button".
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowsClockwise, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import type { ZoomPollAnswerRow } from "@/lib/db/webinar-zoom-polls";

interface QuestionGroup {
  question: string;
  total: number;
  tallies: { answer: string; count: number }[];
  rows: ZoomPollAnswerRow[];
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function toCsv(rows: ZoomPollAnswerRow[]): string {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
  const lines = ["Question,Name,Email,Answer,Answered at,Matched learner"];
  for (const r of rows) {
    lines.push(
      [
        r.question,
        r.respondent_name ?? "—",
        r.respondent_email ?? "—",
        r.answer,
        fmtDateTime(r.answered_at),
        r.matched_user_id ? "yes" : "no",
      ]
        .map((v) => escape(v))
        .join(",")
    );
  }
  return lines.join("\r\n");
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "webinar";
}

function download(filename: string, csv: string): void {
  // Leading BOM so Excel opens it as UTF-8 — respondent names carry accents.
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function WebinarZoomPolls({ webinarId, webinarTitle }: { webinarId: string; webinarTitle: string }) {
  const [answers, setAnswers] = useState<ZoomPollAnswerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async (signal?: { cancelled: boolean }) => {
    try {
      const res = await fetch(`/api/webinars/${webinarId}/zoom-polls`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (signal?.cancelled) return;
      setAnswers((body.answers as ZoomPollAnswerRow[]) ?? []);
    } catch (err) {
      if (!signal?.cancelled) setError(err instanceof Error ? err.message : "Could not load Zoom poll results");
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  };

  useEffect(() => {
    const signal = { cancelled: false };
    void load(signal);
    return () => {
      signal.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webinarId]);

  const sync = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/webinars/${webinarId}/zoom-polls`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.mode === "unconfigured") {
        setError("Syncing poll results needs SUPABASE_SERVICE_ROLE_KEY set server-side.");
        return;
      }
      if (body.imported === 0) {
        setNotice(body.message ?? "Zoom returned no poll answers yet.");
        return;
      }
      setNotice(
        `Synced ${body.imported} answer${body.imported === 1 ? "" : "s"} from ${body.respondents} ` +
          `respondent${body.respondents === 1 ? "" : "s"} · ${body.matchedUsers} matched to learner accounts`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sync from Zoom");
    } finally {
      setBusy(false);
    }
  };

  const groups: QuestionGroup[] = useMemo(() => {
    const byQuestion = new Map<string, ZoomPollAnswerRow[]>();
    for (const row of answers) {
      const list = byQuestion.get(row.question);
      if (list) list.push(row);
      else byQuestion.set(row.question, [row]);
    }
    return [...byQuestion.entries()].map(([question, rows]) => {
      const counts = new Map<string, number>();
      for (const r of rows) counts.set(r.answer, (counts.get(r.answer) ?? 0) + 1);
      return {
        question,
        total: rows.length,
        tallies: [...counts.entries()]
          .map(([answer, count]) => ({ answer, count }))
          .sort((a, b) => b.count - a.count),
        rows,
      };
    });
  }, [answers]);

  const syncedAt = answers[0]?.synced_at ?? null;

  return (
    <div className="mt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
          Zoom polls{syncedAt ? <span className="ml-2 font-normal normal-case tracking-normal text-gray-400">synced {fmtDateTime(syncedAt)}</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void sync()}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-pill border border-gray-200 px-2.5 py-1 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <ArrowsClockwise size={12} weight="bold" /> {busy ? "Syncing…" : "Sync from Zoom"}
          </button>
          <button
            type="button"
            onClick={() => download(`${slugify(webinarTitle)}-zoom-polls.csv`, toCsv(answers))}
            disabled={answers.length === 0}
            className="inline-flex items-center gap-1 rounded-pill border border-gray-200 px-2.5 py-1 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <DownloadSimple size={12} weight="bold" /> Export CSV
          </button>
        </div>
      </div>

      {error ? <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-danger">{error}</p> : null}
      {notice ? <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-[12px] text-green-700">{notice}</p> : null}

      {loading ? (
        <p className="text-[12px] text-gray-500">Loading Zoom poll results…</p>
      ) : groups.length === 0 ? (
        <p className="text-[12px] text-gray-500">
          No Zoom poll results yet. The host launches polls from the Zoom client during the session
          (attendees answer right inside the embedded player) — once the meeting ends, hit Sync from
          Zoom. Results usually appear a few minutes after the session finishes.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <div key={g.question} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <div className="text-[13px] font-medium text-ink">{g.question}</div>
                <div className="shrink-0 text-[11.5px] text-gray-500">
                  {g.total} answer{g.total === 1 ? "" : "s"}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {g.tallies.map((t) => {
                  const pct = Math.round((t.count / g.total) * 100);
                  return (
                    <div key={t.answer} className="flex items-center gap-2">
                      <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-gray-50">
                        <div className="absolute inset-y-0 left-0 bg-teal-100" style={{ width: `${pct}%` }} />
                        <div className="relative flex h-full items-center px-2 text-[12px] text-gray-700">
                          {t.answer}
                        </div>
                      </div>
                      <div className="w-16 shrink-0 text-right text-[12px] text-gray-600">
                        {t.count} · {pct}%
                      </div>
                    </div>
                  );
                })}
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer select-none text-[11.5px] font-medium text-gray-500 hover:text-ink">
                  Show individual answers
                </summary>
                <div className="mt-2 overflow-x-auto rounded-lg border border-gray-100">
                  <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Answer</th>
                        <th className="px-3 py-2">Answered</th>
                        <th className="px-3 py-2">Account</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {g.rows.map((r) => (
                        <tr key={r.id} className="text-gray-700">
                          <td className="px-3 py-2 font-medium text-ink">{r.respondent_name ?? "—"}</td>
                          <td className="px-3 py-2">
                            {r.respondent_email ? (
                              <a href={`mailto:${r.respondent_email}`} className="text-teal-900 hover:underline">
                                {r.respondent_email}
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{r.answer}</td>
                          <td className="px-3 py-2 text-gray-600">{fmtDateTime(r.answered_at)}</td>
                          <td className="px-3 py-2">
                            {r.matched_user_id ? (
                              <span className="rounded-pill bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                                Learner
                              </span>
                            ) : (
                              <span className="rounded-pill bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                                Guest
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
