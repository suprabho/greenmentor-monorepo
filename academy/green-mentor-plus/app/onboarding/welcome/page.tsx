"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useOnboarding } from "@/lib/store/onboarding";
import type { AudienceSegment } from "@/lib/data/audiences";
import { Input } from "@/components/ui/Input";
import { Eyebrow } from "@/components/ui/Badge";
import { BottomNav } from "@/components/onboarding/BottomNav";
import { track } from "@/lib/utils/analytics";

const validSegments: AudienceSegment[] = [
  "student",
  "mid-career",
  "business-leader",
];

function QueryParamSync() {
  const searchParams = useSearchParams();
  const setSegment = useOnboarding((s) => s.setSegment);
  const setPlan = useOnboarding((s) => s.setPlan);
  const setBillingCycle = useOnboarding((s) => s.setBillingCycle);

  useEffect(() => {
    const querySegment = searchParams.get("segment");
    if (querySegment && (validSegments as string[]).includes(querySegment)) {
      setSegment(querySegment as AudienceSegment);
    }
    const queryPlan = searchParams.get("plan");
    if (queryPlan) {
      setPlan(queryPlan);
    }
    const queryCycle = searchParams.get("cycle");
    if (queryCycle === "monthly" || queryCycle === "annual") {
      setBillingCycle(queryCycle);
    }
  }, [searchParams, setSegment, setPlan, setBillingCycle]);

  return null;
}

function WelcomeForm() {
  const router = useRouter();
  const { name, email, setIdentity } = useOnboarding();

  const [nameInput, setNameInput] = useState(name);
  const [emailInput, setEmailInput] = useState(email);
  const [touched, setTouched] = useState(false);

  const nameValid = nameInput.trim().length >= 2;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim());
  const canContinue = nameValid && emailValid;

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    setTouched(true);
    if (!canContinue) return;
    setIdentity({ name: nameInput, email: emailInput });
    track("onboarding_step_completed", { step: "welcome" });
    router.push("/onboarding/audience");
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <Eyebrow tone="white">Welcome</Eyebrow>
      <h1 className="font-display mt-8 text-[40px] leading-tight tracking-[-0.02em] text-ink md:text-[56px]">
        Let&apos;s get the basics.
      </h1>
      <p className="mt-4 text-[17px] leading-relaxed text-gray-700">
        We&apos;ll use this to personalize the next few questions — no spam,
        no calls.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-5" noValidate>
        <Input
          label="Full name"
          placeholder="Aanya Mehra"
          autoComplete="name"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          error={
            touched && !nameValid
              ? "Please enter at least 2 characters."
              : undefined
          }
        />
        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="aanya@company.com"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          error={
            touched && !emailValid
              ? "That doesn't look like a valid email."
              : undefined
          }
        />

        <BottomNav
          backHref="/onboarding/intro"
          onContinue={handleSubmit}
          continueDisabled={touched && !canContinue}
        />
      </form>
    </motion.div>
  );
}

export default function WelcomeStep() {
  return (
    <>
      <Suspense fallback={null}>
        <QueryParamSync />
      </Suspense>
      <WelcomeForm />
    </>
  );
}
