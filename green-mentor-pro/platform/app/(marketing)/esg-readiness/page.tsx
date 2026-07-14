"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";

import { QuestionCard } from "@/components/esg-readiness/QuestionCard";
import { Results, type AssessmentResponse } from "@/components/esg-readiness/Results";
import { QUESTIONS, type QuestionSpec } from "@/lib/esg-readiness/wizard-config";
import { useEsgReadiness } from "@/lib/store/esgReadiness";
import type { Answers } from "@/lib/esg-readiness/types";

type Screen =
  | { type: "intro" }
  | { type: "transition" }
  | { type: "question"; q: QuestionSpec; number: number };

// Build the ordered screen list: intro → Q1–Q7 → section-break → Q8–Q18.
function buildScreens(): Screen[] {
  const screens: Screen[] = [{ type: "intro" }];
  QUESTIONS.forEach((q, i) => {
    screens.push({ type: "question", q, number: i + 1 });
    if (q.id === "q7_mnc") screens.push({ type: "transition" });
  });
  return screens;
}

export default function EsgReadinessPage() {
  const screens = useMemo(buildScreens, []);
  const { answers, setAnswer, reset } = useEsgReadiness();

  const [step, setStep] = useState(0);
  const [result, setResult] = useState<AssessmentResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const screen = screens[step];
  const isLast = step === screens.length - 1;

  function canContinue(): boolean {
    if (screen.type === "intro") return !!answers.companyName?.trim();
    if (screen.type === "transition") return true;
    const v = answers[screen.q.id];
    if (screen.q.kind === "multi") return Array.isArray(v) && v.length > 0;
    return typeof v === "string" && v.trim().length > 0;
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const utm = new URLSearchParams(window.location.search).get("utm_source");
      const res = await fetch("/api/esg-readiness/assess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: answers as Answers, sourceUtm: utm }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setResult(json as AssessmentResponse);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (isLast) return submit();
    setStep((s) => s + 1);
  }

  if (result) {
    return (
      <div className="px-5 pt-28 pb-20">
        <Results result={result} />
      </div>
    );
  }

  const totalQuestions = QUESTIONS.length;

  return (
    <div className="px-5 pt-28 pb-20">
      <div className="mx-auto max-w-2xl space-y-7">
        {/* progress */}
        {screen.type === "question" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11.5px] font-medium text-gray-500">
              <span>Question {screen.number} of {totalQuestions}</span>
              <span>Section {screen.q.section}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-teal-900 transition-all"
                style={{ width: `${(screen.number / totalQuestions) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* intro */}
        {screen.type === "intro" && (
          <section className="space-y-5">
            <div className="space-y-2">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-green-700">
                ESG Applicability &amp; Readiness Assessment
              </p>
              <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink">
                Which ESG regulations apply to your business — and how ready are you?
              </h1>
              <p className="text-[15px] leading-relaxed text-gray-600">
                A 6-minute assessment. Get an instant applicability check and a personalised readiness report.
              </p>
            </div>
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-medium text-gray-600">Your company name</span>
              <input
                autoFocus
                value={answers.companyName ?? ""}
                onChange={(e) => setAnswer("companyName", e.target.value)}
                className="w-full rounded-[10px] border border-gray-200 bg-white px-4 py-3 text-[14.5px] text-ink outline-none focus:border-teal-900"
                placeholder="e.g. Acme Manufacturing Pvt Ltd"
              />
            </label>
          </section>
        )}

        {/* section-break transition */}
        {screen.type === "transition" && (
          <section className="space-y-3 text-center">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-green-700">Section 1 complete</p>
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">Great — that&apos;s the first half done.</h1>
            <p className="mx-auto max-w-md text-[14px] leading-relaxed text-gray-600">
              Section 2 covers your current readiness — your data systems, your team, your governance, and what
              you&apos;ve already done on ESG. 11 questions left. About 3 minutes.
            </p>
          </section>
        )}

        {/* question */}
        {screen.type === "question" && <QuestionCard q={screen.q} />}

        {error && <p className="rounded-[6px] bg-red-50 px-3 py-2 text-[12.5px] text-danger">{error}</p>}

        {/* nav */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="text-[13px] font-semibold text-gray-500 hover:text-ink disabled:opacity-0"
          >
            ← Back
          </button>
          <button
            onClick={next}
            disabled={!canContinue() || submitting}
            className="inline-flex items-center gap-1.5 rounded-pill bg-teal-900 px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
          >
            {submitting
              ? "Computing…"
              : screen.type === "intro"
                ? "Begin assessment"
                : isLast
                  ? "See my results"
                  : "Continue"}
            {!submitting && <ArrowRight size={15} weight="bold" />}
          </button>
        </div>

        {step === 0 && (
          <p className="text-center text-[11px] text-gray-400">
            <button onClick={reset} className="underline-offset-2 hover:underline">
              Reset
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
