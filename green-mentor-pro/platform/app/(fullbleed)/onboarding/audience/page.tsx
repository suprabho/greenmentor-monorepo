"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useOnboarding } from "@/lib/store/onboarding";
import { audiences } from "@/lib/onboarding-data";
import { ChoiceCard } from "@/components/onboarding/ChoiceCard";
import { BottomNav } from "@/components/onboarding/BottomNav";
import { StepError } from "@/components/onboarding/StepError";
import { saveProfile } from "@/lib/onboarding/save";

export default function AudienceStep() {
  const router = useRouter();
  const { segment, setSegment } = useOnboarding();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!segment || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveProfile({ segment });
      router.push("/onboarding/goals");
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
          Where are you right now?
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-white/80">
          Pick the path that maps best. We use this to tune what we show you on the next step.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {audiences.map((a) => (
          <ChoiceCard
            key={a.id}
            selected={segment === a.id}
            onSelect={() => setSegment(a.id)}
            title={a.label}
            tagline={a.tagline}
            description={a.description}
            icon={a.icon}
          />
        ))}
      </div>

      <StepError message={error} />

      <BottomNav
        backHref="/onboarding/welcome"
        onContinue={handleContinue}
        continueDisabled={!segment}
        continueLoading={saving}
      />
    </motion.div>
  );
}
