"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useOnboarding } from "@/lib/store/onboarding";
import { goals } from "@/lib/data/goals";
import { MultiSelectChips } from "@/components/onboarding/MultiSelectChips";
import { BottomNav } from "@/components/onboarding/BottomNav";
import { track } from "@/lib/utils/analytics";
import { syncLead } from "@/lib/lead/sync";

export default function GoalsStep() {
  const router = useRouter();
  const { goals: selected, toggleGoal } = useOnboarding();

  const canContinue = selected.length > 0;

  function handleContinue() {
    if (!canContinue) return;
    track("onboarding_step_completed", {
      step: "goals",
      count: selected.length,
    });
    syncLead("goals");
    router.push("/onboarding/plan");
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
          Pick anything that resonates — at least one. You can change this later
          from your dashboard.
        </p>

        <div className="mt-10">
          <MultiSelectChips
            options={goals}
            selected={selected}
            onToggle={toggleGoal}
          />
          <p className="mt-4 text-[14px] text-white/60">
            {selected.length === 0
              ? "Pick at least one goal to continue."
              : `${selected.length} selected.`}
          </p>
        </div>
      </div>

      <BottomNav
        backHref="/onboarding/audience"
        onContinue={handleContinue}
        continueDisabled={!canContinue}
      />
    </motion.div>
  );
}
