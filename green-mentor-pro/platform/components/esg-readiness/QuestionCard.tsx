"use client";

import { Check } from "@phosphor-icons/react";
import { clsx } from "clsx";

import { SUBSECTORS } from "@/lib/esg-readiness/questions";
import type { QuestionSpec } from "@/lib/esg-readiness/wizard-config";
import { useEsgReadiness } from "@/lib/store/esgReadiness";
import type { Answers } from "@/lib/esg-readiness/types";

/** Renders one questionnaire screen based on its kind (Doc 2). */
export function QuestionCard({ q }: { q: QuestionSpec }) {
  const { answers, setAnswer, toggleMulti } = useEsgReadiness();
  const value = answers[q.id];

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-[24px] font-semibold leading-snug tracking-tight text-ink">{q.title}</h1>
        {q.help && <p className="mt-2 text-[13.5px] leading-relaxed text-gray-600">{q.help}</p>}
      </div>

      {q.kind === "dropdown" && (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => setAnswer(q.id, e.target.value as Answers[typeof q.id])}
          className="w-full rounded-[10px] border border-gray-200 bg-white px-4 py-3 text-[14.5px] text-ink outline-none focus:border-teal-900"
        >
          <option value="" disabled>
            Select…
          </option>
          {q.options!.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      {q.kind === "subsector" && <SubsectorField />}

      {q.kind === "single" &&
        q.options && (
          <div className="grid gap-2.5">
            {q.options.map((o) => {
              const active = value === o.code;
              return (
                <button
                  key={o.code}
                  type="button"
                  onClick={() => setAnswer(q.id, o.code as Answers[typeof q.id])}
                  className={clsx(
                    "flex items-center justify-between rounded-[10px] border px-4 py-3 text-left text-[14px] transition-colors",
                    active
                      ? "border-teal-900 bg-teal-900/[0.03] ring-1 ring-teal-900 text-ink"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300",
                  )}
                >
                  <span>{o.label}</span>
                  {active && <Check size={16} weight="bold" className="shrink-0 text-teal-900" />}
                </button>
              );
            })}
          </div>
        )}

      {q.kind === "multi" && q.options && (
        <div className="grid gap-2.5">
          {q.options.map((o) => {
            const selected = ((value as string[] | undefined) ?? []).includes(o.code);
            return (
              <button
                key={o.code}
                type="button"
                onClick={() => toggleMulti(q.id as "q8_systems" | "q17_outputs", o.code)}
                className={clsx(
                  "flex items-center gap-3 rounded-[10px] border px-4 py-3 text-left text-[14px] transition-colors",
                  selected
                    ? "border-green-700 bg-green-50 text-ink"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300",
                )}
              >
                <span
                  className={clsx(
                    "grid size-5 shrink-0 place-items-center rounded-[5px] border",
                    selected ? "border-green-700 bg-green-700 text-white" : "border-gray-300",
                  )}
                >
                  {selected && <Check size={13} weight="bold" />}
                </span>
                <span>{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Q2 — dropdown of sub-sectors for the chosen Q1, or free text when Q1 = "other". */
function SubsectorField() {
  const { answers, setAnswer } = useEsgReadiness();
  const sector = answers.q1_sector;
  const options = sector ? SUBSECTORS[sector] : undefined;

  if (!sector) {
    return <p className="text-[13.5px] text-gray-500">Please choose your primary sector first.</p>;
  }

  if (!options) {
    // Q1 = "other" (or any sector without a fixed list) → free text.
    return (
      <input
        type="text"
        value={answers.q2_subsector ?? ""}
        onChange={(e) => setAnswer("q2_subsector", e.target.value)}
        placeholder="Describe your sub-sector"
        className="w-full rounded-[10px] border border-gray-200 bg-white px-4 py-3 text-[14.5px] text-ink outline-none focus:border-teal-900"
      />
    );
  }

  return (
    <select
      value={answers.q2_subsector ?? ""}
      onChange={(e) => setAnswer("q2_subsector", e.target.value)}
      className="w-full rounded-[10px] border border-gray-200 bg-white px-4 py-3 text-[14.5px] text-ink outline-none focus:border-teal-900"
    >
      <option value="" disabled>
        Select…
      </option>
      {options.map((label) => (
        <option key={label} value={label}>
          {label}
        </option>
      ))}
    </select>
  );
}
