"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle, Coins, Lightning, X, XCircle } from "@phosphor-icons/react";
import { Card, Chip, PageHeader, ProgressBar } from "@/components/ui";

type QuestionOption = { key: string; text: string };
type Question = { id: string; stem: string; options: QuestionOption[] };

type Answered = Record<
  string,
  { selectedKey: string; correct: boolean; correctKey: string; explanation: string | null }
>;

type SubmitResult = {
  scorePct: number;
  passed: boolean;
  xpAwarded: number;
  coinsAwarded: number;
};

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function AssessmentRunner({
  moduleTitle,
  assessment,
  questions,
  alreadyPassed,
  overviewHref,
  nextHref,
}: {
  moduleTitle: string;
  assessment: { id: string; title: string; shuffleOptions: boolean };
  questions: Question[];
  alreadyPassed: boolean;
  overviewHref: string;
  nextHref: string;
}) {
  const router = useRouter();
  const [attemptKey, setAttemptKey] = useState(0);

  // Reshuffled per attempt (client-side only — correct_key never reaches
  // the browser, so shuffling here can't leak the answer).
  const orderedQuestions = useMemo(
    () =>
      questions.map((q) => ({
        ...q,
        options: assessment.shuffleOptions ? shuffled(q.options) : q.options,
      })),
    // attemptKey deliberately triggers a reshuffle on retry
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, assessment.shuffleOptions, attemptKey]
  );

  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState<Answered>({});
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (alreadyPassed && !result) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title={assessment.title} sub={moduleTitle} />
        <Card className="p-6 text-center">
          <CheckCircle size={32} weight="fill" className="mx-auto text-green-500" />
          <div className="mt-2 text-[14px] font-semibold text-ink">Already passed</div>
          <Link
            href={nextHref}
            className="mt-4 inline-flex items-center gap-1.5 rounded-pill bg-teal-900 px-4 py-2 text-[12.5px] font-semibold text-white"
          >
            Continue <ArrowRight size={13} weight="bold" />
          </Link>
        </Card>
      </div>
    );
  }

  if (result) {
    const correctCount = Object.values(answered).filter((a) => a.correct).length;
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title={assessment.title} sub={moduleTitle} />
        <Card className="p-6 text-center">
          {result.passed ? (
            <CheckCircle size={32} weight="fill" className="mx-auto text-green-500" />
          ) : (
            <XCircle size={32} weight="fill" className="mx-auto text-danger" />
          )}
          <div className="mt-2 text-[18px] font-semibold text-ink">{result.scorePct}%</div>
          <div className="text-[13px] text-gray-600">
            {correctCount} of {orderedQuestions.length} correct — {result.passed ? "Passed" : "Not quite"}
          </div>
          {(result.xpAwarded > 0 || result.coinsAwarded > 0) && (
            <div className="mt-3 flex justify-center gap-2">
              {result.xpAwarded > 0 && (
                <Chip tone="green">
                  <Lightning size={12} weight="fill" /> +{result.xpAwarded} XP
                </Chip>
              )}
              {result.coinsAwarded > 0 && (
                <Chip>
                  <Coins size={12} weight="fill" /> +{result.coinsAwarded} cr
                </Chip>
              )}
            </div>
          )}
          <div className="mt-5 flex justify-center gap-3">
            {result.passed ? (
              <Link
                href={nextHref}
                className="flex items-center gap-1.5 rounded-pill bg-teal-900 px-4 py-2 text-[12.5px] font-semibold text-white"
              >
                Continue <ArrowRight size={13} weight="bold" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAttemptKey((k) => k + 1);
                  setIdx(0);
                  setAnswered({});
                  setResult(null);
                  setError(null);
                }}
                className="rounded-pill bg-teal-900 px-4 py-2 text-[12.5px] font-semibold text-white"
              >
                Retry
              </button>
            )}
            <Link
              href={overviewHref}
              className="rounded-pill border border-gray-200 px-4 py-2 text-[12.5px] font-semibold text-gray-700"
            >
              Back to course
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const question = orderedQuestions[idx];
  const current = answered[question.id];
  const correctCountSoFar = Object.values(answered).filter((a) => a.correct).length;

  async function selectOption(key: string) {
    if (current || checking) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch(`/api/academy/assessments/${assessment.id}/check-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, selectedKey: key }),
      });
      if (!res.ok) throw new Error("could not check answer");
      const data = await res.json();
      setAnswered((prev) => ({
        ...prev,
        [question.id]: {
          selectedKey: key,
          correct: data.correct,
          correctKey: data.correctKey,
          explanation: data.explanation,
        },
      }));
    } catch {
      setError("Something went wrong checking that answer. Try again.");
    } finally {
      setChecking(false);
    }
  }

  async function next() {
    if (idx < orderedQuestions.length - 1) {
      setIdx((i) => i + 1);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/academy/assessments/${assessment.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: orderedQuestions.map((q) => ({ questionId: q.id, selectedKey: answered[q.id]?.selectedKey ?? "" })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "could not submit assessment");
      }
      const data = (await res.json()) as SubmitResult;
      setResult(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong submitting the assessment. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between text-[11.5px] font-semibold text-gray-600">
            <span>
              Question {idx + 1} of {orderedQuestions.length}
            </span>
            <span>{correctCountSoFar} correct</span>
          </div>
          <ProgressBar value={Math.round((idx / orderedQuestions.length) * 100)} />
        </div>
        <Link href={overviewHref} className="text-gray-400 hover:text-gray-600" aria-label="Close assessment">
          <X size={20} />
        </Link>
      </div>

      <Card className="p-6">
        <h2 className="text-[15.5px] font-semibold text-ink">{question.stem}</h2>

        <div className="mt-4 space-y-2">
          {question.options.map((opt) => {
            const isSelected = current?.selectedKey === opt.key;
            const isCorrectOpt = !!current && opt.key === current.correctKey;
            let tone = "border-gray-200 bg-white";
            if (current) {
              if (isCorrectOpt) tone = "border-green-500 bg-green-50";
              else if (isSelected) tone = "border-danger bg-red-50";
            }
            return (
              <button
                key={opt.key}
                type="button"
                disabled={!!current || checking}
                onClick={() => selectOption(opt.key)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-[13.5px] font-medium text-ink transition-colors ${tone} ${
                  !current ? "hover:border-teal-900" : ""
                }`}
              >
                {opt.text}
                {isCorrectOpt && <CheckCircle size={18} weight="fill" className="text-green-500" />}
                {current && isSelected && !isCorrectOpt && <XCircle size={18} weight="fill" className="text-danger" />}
              </button>
            );
          })}
        </div>

        {current && (
          <div
            className={`mt-4 rounded-xl p-3 text-[12.5px] ${
              current.correct ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
            }`}
          >
            <div className="font-semibold">{current.correct ? "Correct" : "Not quite"}</div>
            {current.explanation && <p className="mt-1">{current.explanation}</p>}
          </div>
        )}

        {error && <p className="mt-3 text-[12.5px] text-danger">{error}</p>}

        {current && (
          <button
            type="button"
            onClick={next}
            disabled={submitting}
            className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-pill bg-teal-900 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {idx < orderedQuestions.length - 1 ? "Next question" : submitting ? "Submitting…" : "See results"}
            <ArrowRight size={14} weight="bold" />
          </button>
        )}
      </Card>
    </div>
  );
}
