"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CaretLeft,
  CheckCircle,
  XCircle,
  Sparkle,
  Lightbulb,
  Lightning,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { Card, Chip } from "@/components/ui";
import { lesson, quiz } from "@/lib/data";

export default function LessonPage() {
  const [picked, setPicked] = useState<string | null>(null);
  const [tab, setTab] = useState<"ask" | "notes">("ask");
  const correct = picked && quiz.options.find((o) => o.id === picked)?.correct;

  return (
    <div>
      {/* Lesson header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/academy/course" className="flex items-center gap-1 text-[12.5px] font-semibold text-gray-600 hover:text-ink">
          <CaretLeft size={14} /> {lesson.module}
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Chip tone="green"><Lightning size={11} weight="fill" /> +30 XP on completion</Chip>
          <Chip tone="neutral">{lesson.mins} min</Chip>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {/* Lesson body */}
        <div>
          <Card className="p-6 md:p-8">
            {/* progress dots */}
            <div className="mb-5 flex items-center gap-1.5">
              {Array.from({ length: lesson.total }).map((_, i) => (
                <span
                  key={i}
                  className={
                    "h-1.5 flex-1 rounded-pill " +
                    (i < lesson.index ? "bg-green-500" : i === lesson.index ? "bg-teal-900" : "bg-gray-100")
                  }
                />
              ))}
              <span className="ml-2 text-[11.5px] font-semibold text-gray-500">
                {lesson.index + 1}/{lesson.total}
              </span>
            </div>

            <h1 className="text-[22px] font-semibold tracking-tight text-ink">{lesson.title}</h1>
            <div className="mt-4 space-y-4">
              {lesson.body.map((p, i) => (
                <p key={i} className="text-[14.5px] leading-relaxed text-gray-800">{p}</p>
              ))}
            </div>

            <div className="mt-6 flex gap-3 rounded-2xl bg-green-50 p-4">
              <Lightbulb size={20} weight="fill" className="shrink-0 text-green-700" />
              <p className="text-[13.5px] font-medium leading-relaxed text-teal-800">{lesson.keyTakeaway}</p>
            </div>

            {/* Quiz */}
            <div className="mt-8 border-t border-gray-100 pt-6">
              <div className="mb-3 flex items-center gap-2">
                <Chip tone="teal">Quick check</Chip>
                <span className="text-[12px] text-gray-600">Pass to keep your streak multiplier</span>
              </div>
              <p className="text-[14.5px] font-medium leading-relaxed text-ink">{quiz.question}</p>
              <div className="mt-4 space-y-2.5">
                {quiz.options.map((o) => {
                  const state =
                    picked === null ? "idle" : o.correct ? "correct" : picked === o.id ? "wrong" : "muted";
                  return (
                    <button
                      key={o.id}
                      onClick={() => setPicked(o.id)}
                      disabled={picked !== null}
                      className={
                        "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left text-[13.5px] font-medium transition-colors " +
                        (state === "correct"
                          ? "border-green-500 bg-green-50 text-teal-800"
                          : state === "wrong"
                          ? "border-danger bg-red-50 text-danger"
                          : state === "muted"
                          ? "border-gray-100 text-gray-400"
                          : "border-gray-200 text-gray-800 hover:border-teal-900")
                      }
                    >
                      <span className="grid size-6 shrink-0 place-items-center rounded-full border border-current text-[11px] font-bold uppercase">
                        {o.id}
                      </span>
                      {o.text}
                      {state === "correct" && <CheckCircle size={18} weight="fill" className="ml-auto shrink-0 text-green-700" />}
                      {state === "wrong" && <XCircle size={18} weight="fill" className="ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {picked && (
                <div
                  className={
                    "mt-4 rounded-xl p-4 text-[13px] leading-relaxed " +
                    (correct ? "bg-green-50 text-teal-800" : "bg-red-50 text-gray-800")
                  }
                >
                  <strong>{correct ? "Correct — +15 XP." : "Not quite."}</strong> {quiz.explanation}
                </div>
              )}
            </div>

            {/* Nav */}
            <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-5">
              <button className="flex items-center gap-1.5 rounded-pill border border-gray-200 px-4 py-2 text-[13px] font-semibold text-gray-700">
                <ArrowLeft size={15} /> Previous
              </button>
              <button className="flex items-center gap-1.5 rounded-pill bg-teal-900 px-5 py-2 text-[13px] font-semibold text-white hover:bg-teal-800">
                Next lesson <ArrowRight size={15} weight="bold" />
              </button>
            </div>
          </Card>
        </div>

        {/* Ask AI panel */}
        <aside>
          <Card className="flex h-full min-h-[480px] flex-col overflow-hidden">
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setTab("ask")}
                className={
                  "flex flex-1 items-center justify-center gap-1.5 py-3 text-[13px] font-semibold " +
                  (tab === "ask" ? "border-b-2 border-green-500 text-teal-900" : "text-gray-500")
                }
              >
                <Sparkle size={15} weight={tab === "ask" ? "fill" : "regular"} /> Ask AI
              </button>
              <button
                onClick={() => setTab("notes")}
                className={
                  "flex flex-1 items-center justify-center py-3 text-[13px] font-semibold " +
                  (tab === "notes" ? "border-b-2 border-green-500 text-teal-900" : "text-gray-500")
                }
              >
                Notes
              </button>
            </div>

            {tab === "ask" ? (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  <div className="rounded-2xl rounded-tl-sm bg-gray-50 p-3.5 text-[13px] leading-relaxed text-gray-800">
                    Hi Supro — I have this lesson&apos;s context loaded. Ask me anything about scopes and boundaries.
                  </div>
                  <div className="ml-8 rounded-2xl rounded-tr-sm bg-teal-900 p-3.5 text-[13px] leading-relaxed text-white">
                    If we use a co-working space, is that electricity Scope 2 or 3?
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-gray-50 p-3.5 text-[13px] leading-relaxed text-gray-800">
                    Usually <strong>Scope 3 (Category 8 — upstream leased assets)</strong>, because you don&apos;t hold the utility contract. If your lease gives you operational control over metered space, it can shift to Scope 2. The boundary test from this lesson applies: control → 1, contract → 2, cause → 3.
                  </div>
                </div>
                <div className="border-t border-gray-100 p-3">
                  <div className="mb-2 text-center text-[11px] font-medium text-gray-500">
                    Free tier: 14 of 20 questions left today
                  </div>
                  <div className="flex items-center gap-2 rounded-pill border border-gray-200 bg-gray-50 px-4 py-2.5">
                    <span className="flex-1 text-[13px] text-gray-400">Ask about this lesson…</span>
                    <PaperPlaneTilt size={17} className="text-teal-900" />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 p-4">
                <div className="h-full rounded-xl border border-dashed border-gray-200 p-4 text-[13px] text-gray-400">
                  Your notes for this lesson…
                </div>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
