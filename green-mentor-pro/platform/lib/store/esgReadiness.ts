import { create } from "zustand";

import type { Answers } from "@/lib/esg-readiness/types";

// Client wizard state for the ESG Applicability & Readiness assessment. Held
// in memory only (no persist) — per Doc 3 edge case 4, v1 does not save progress;
// a refresh starts from the intro screen. Saved sessions are a v2 feature.

export type WizardAnswers = Partial<Answers>;

interface EsgReadinessState {
  answers: WizardAnswers;
  setAnswer: <K extends keyof Answers>(key: K, value: Answers[K]) => void;
  toggleMulti: (key: "q8_systems" | "q17_outputs", code: string) => void;
  reset: () => void;
}

export const useEsgReadiness = create<EsgReadinessState>((set) => ({
  answers: {},
  setAnswer: (key, value) => set((s) => ({ answers: { ...s.answers, [key]: value } })),
  // Multi-select toggle with mutually-exclusive "none" (Doc 2, Q8 & Q17):
  // selecting "none" clears everything else; selecting anything else drops "none".
  toggleMulti: (key, code) =>
    set((s) => {
      const current = (s.answers[key] as string[] | undefined) ?? [];
      let next: string[];
      if (code === "none") {
        next = current.includes("none") ? [] : ["none"];
      } else {
        const without = current.filter((c) => c !== "none" && c !== code);
        next = current.includes(code) ? without : [...without, code];
      }
      return { answers: { ...s.answers, [key]: next } };
    }),
  reset: () => set({ answers: {} }),
}));
