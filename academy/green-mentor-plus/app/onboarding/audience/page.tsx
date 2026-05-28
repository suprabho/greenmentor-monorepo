"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useOnboarding } from "@/lib/store/onboarding";
import { audiences } from "@/lib/data/audiences";
import { Eyebrow } from "@/components/ui/Badge";
import { ChoiceCard } from "@/components/onboarding/ChoiceCard";
import { BottomNav } from "@/components/onboarding/BottomNav";
import { track } from "@/lib/utils/analytics";

export default function AudienceStep() {
  const router = useRouter();
  const { segment, setSegment } = useOnboarding();

  function handleContinue() {
    if (!segment) return;
    track("onboarding_step_completed", { step: "audience", segment });
    router.push("/onboarding/goals");
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <Eyebrow tone="white">About You</Eyebrow>
      <h1 className="font-display mt-8 text-[40px] leading-tight tracking-[-0.02em] text-ink md:text-[56px]">
        Where are you right now?
      </h1>
      <p className="mt-4 text-[17px] leading-relaxed text-gray-700">
        Pick the path that maps best. We use this to tune what we show you on
        the next step.
      </p>

      <div className="mt-10 grid gap-4">
        {audiences.map((audience) => (
          <ChoiceCard
            key={audience.id}
            selected={segment === audience.id}
            onSelect={() => setSegment(audience.id)}
            title={audience.label}
            tagline={audience.tagline}
            description={audience.description}
            icon={audience.icon}
          />
        ))}
      </div>

      <BottomNav
        backHref="/onboarding/welcome"
        onContinue={handleContinue}
        continueDisabled={!segment}
      />
    </motion.div>
  );
}
