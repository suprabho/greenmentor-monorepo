"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { useOnboarding } from "@/lib/store/onboarding";
import type { AudienceSegment } from "@/lib/data/audiences";
import { introCards } from "@/lib/data/intro-cards";
import { Button } from "@/components/ui/Button";
import { IntroCarousel } from "@/components/onboarding/IntroCarousel";
import { track } from "@/lib/utils/analytics";

const validSegments: AudienceSegment[] = [
  "student",
  "mid-career",
  "business-leader",
];

/** Capture deep-link params (?segment=, ?plan=) before the user steps in. */
function QueryParamSync() {
  const searchParams = useSearchParams();
  const setSegment = useOnboarding((s) => s.setSegment);
  const setPlan = useOnboarding((s) => s.setPlan);

  useEffect(() => {
    const querySegment = searchParams.get("segment");
    if (querySegment && (validSegments as string[]).includes(querySegment)) {
      setSegment(querySegment as AudienceSegment);
    }
    const queryPlan = searchParams.get("plan");
    if (queryPlan) setPlan(queryPlan);
  }, [searchParams, setSegment, setPlan]);

  return null;
}

function IntroBody() {
  const router = useRouter();

  function handleContinue() {
    track("onboarding_step_completed", { step: "intro" });
    router.push("/onboarding/welcome");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
      className="flex min-h-full flex-1 flex-col"
    >
      <div className="flex flex-col">
        <h1 className="font-display text-[32px] leading-tight tracking-[-0.02em] text-white sm:text-[40px] md:text-[48px]">
          The only subscription you need to master anything in ESG.
        </h1>
        <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-white/80 md:text-[17px]">
          Courses, live expert sessions, career tools, and a community of 40,000+
          sustainability professionals all in one place, for one simple price.
        </p>
        <div className="mt-10">
          <IntroCarousel cards={introCards} />
        </div>
      </div>

      <div className="sticky bottom-0 z-30 -mx-6 mt-auto flex flex-col-reverse items-center gap-3 border-t border-white/10 bg-teal-900/85 px-6 py-4 backdrop-blur sm:flex-row sm:justify-between md:-mx-8 md:px-8">
        <Link
          href="/"
          className="text-[14px] text-white/60 underline-offset-4 hover:underline"
        >
          Back to home
        </Link>
        <Button
          variant="primary"
          size="lg"
          onClick={handleContinue}
          iconRight={<ArrowRight size={18} weight="bold" />}
          className="w-full sm:w-auto"
        >
          Continue
        </Button>
      </div>
    </motion.div>
  );
}

export default function IntroStep() {
  return (
    <>
      <Suspense fallback={null}>
        <QueryParamSync />
      </Suspense>
      <IntroBody />
    </>
  );
}
