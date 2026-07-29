"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useOnboarding } from "@/lib/store/onboarding";
import { goals as goalOptions } from "@/lib/onboarding-data";
import { MultiSelectChips } from "@/components/onboarding/MultiSelectChips";
import { BottomNav } from "@/components/onboarding/BottomNav";
import { StepError } from "@/components/onboarding/StepError";
import { saveProfile } from "@/lib/onboarding/save";

export default function GoalsStep() {
  const router = useRouter();
  const { goals: selected, toggleGoal } = useOnboarding();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = selected.length > 0;

  async function handleContinue() {
    if (!canContinue || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveProfile({ goals: selected });
      router.push("/onboarding/plan");
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
          Pick anything that resonates — at least one. You can change this later from your profile.
        </p>

        <div className="mt-10">
          <MultiSelectChips options={goalOptions} selected={selected} onToggle={toggleGoal} />
          <p className="mt-4 text-[14px] text-white/60">
            {selected.length === 0
              ? "Pick at least one goal to continue."
              : `${selected.length} selected.`}
          </p>
        </div>
      </div>

      <StepError message={error} />

      <BottomNav
        backHref="/onboarding/audience"
        onContinue={handleContinue}
        continueDisabled={!canContinue}
        continueLoading={saving}
      />
    </motion.div>
  );
}
