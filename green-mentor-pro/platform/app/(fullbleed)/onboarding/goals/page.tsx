"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useOnboarding } from "@/lib/store/onboarding";
import { goals as goalOptions } from "@/lib/onboarding-data";
import { MAX_GOALS } from "@/lib/onboarding/goals";
import { MultiSelectChips } from "@/components/onboarding/MultiSelectChips";
import { BottomNav } from "@/components/onboarding/BottomNav";
import { StepError } from "@/components/onboarding/StepError";
import { saveProfile } from "@/lib/onboarding/save";

export default function GoalsStep() {
  const { goals: selected, toggleGoal, nextHref, setNextHref } = useOnboarding();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = selected.length > 0;

  async function handleFinish() {
    if (!canContinue || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveProfile({ goals: selected, onboarded: true });
      // Land on whatever brought them here — a shared webinar/job/post link
      // that bounced through sign-in — rather than always /home.
      const destination = nextHref ?? "/home";
      setNextHref(null); // one-shot; don't misroute a future run
      // Hard navigation: the gate in (app)/layout.tsx reads `onboarded` server
      // side, so we want a fresh render rather than a cached RSC payload that
      // would bounce us straight back here.
      window.location.assign(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
      className="flex min-h-full flex-1 flex-col"
    >
      <div>
        <h1 className="font-display text-[40px] leading-tight tracking-[-0.02em] text-white md:text-[56px]">
          What would success look like in 3 months?
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-white/80">
          Pick up to {MAX_GOALS} — the ones you could realistically move in the next three months. You can
          change this later from your profile.
        </p>

        <div className="mt-10">
          <MultiSelectChips
            options={goalOptions}
            selected={selected}
            onToggle={toggleGoal}
            max={MAX_GOALS}
          />
          <p className="mt-4 text-[14px] text-white/60">
            {selected.length === 0
              ? "Pick at least one goal to continue."
              : `${selected.length} of ${MAX_GOALS} chosen.`}
          </p>
        </div>
      </div>

      <StepError message={error} />

      <BottomNav
        backHref="/onboarding/audience"
        onContinue={handleFinish}
        continueLabel="Finish & enter Green Mentor Pro"
        continueDisabled={!canContinue}
        continueLoading={saving}
      />
    </motion.div>
  );
}
