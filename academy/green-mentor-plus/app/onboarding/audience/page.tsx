"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useOnboarding } from "@/lib/store/onboarding";
import { audiences } from "@/lib/data/audiences";
import { ChoiceCard } from "@/components/onboarding/ChoiceCard";
import { BottomNav } from "@/components/onboarding/BottomNav";
import { track } from "@/lib/utils/analytics";
import { syncLead } from "@/lib/lead/sync";

export default function AudienceStep() {
  const router = useRouter();
  const { segment, setSegment } = useOnboarding();

  function handleContinue() {
    if (!segment) return;
    track("onboarding_step_completed", { step: "audience", segment });
    syncLead("audience");
    router.push("/onboarding/goals");
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
      className="flex max-h-[calc(100vh-40px)] flex-1 flex-col"
    >
      <div>
        <h1 className="font-display text-[40px] leading-tight tracking-[-0.02em] text-white md:text-[56px]">
          Where are you right now?
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-white/80">
          Pick the path that maps best. We use this to tune what we show you on
          the next step.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
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
      </div>

      <BottomNav
        backHref="/onboarding/welcome"
        onContinue={handleContinue}
        continueDisabled={!segment}
      />
    </motion.div>
  );
}
