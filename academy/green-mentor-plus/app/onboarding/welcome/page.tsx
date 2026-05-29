"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useOnboarding } from "@/lib/store/onboarding";
import type { AudienceSegment } from "@/lib/data/audiences";
import { Input } from "@/components/ui/Input";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { BottomNav } from "@/components/onboarding/BottomNav";
import { track } from "@/lib/utils/analytics";
import { syncLead } from "@/lib/lead/sync";
import { countryByIso } from "@/lib/data/country-codes";
import { detectCountryIso } from "@/lib/utils/geo";

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
  const { name, email, phone, phoneCountry, setIdentity } = useOnboarding();

  const [nameInput, setNameInput] = useState(name);
  const [emailInput, setEmailInput] = useState(email);
  // National number only (digits); the dial code lives on `countryIso`.
  const [phoneInput, setPhoneInput] = useState(phone);
  const [countryIso, setCountryIso] = useState(phoneCountry);
  // Becomes true once the user touches the country picker — keeps the IP
  // detection from overriding a deliberate choice if it resolves late.
  const [countryPicked, setCountryPicked] = useState(false);
  const [touched, setTouched] = useState(false);

  // Auto-detect the country code from the visitor's IP / ISP and pre-fill the
  // picker, unless the store already has a saved choice or the user picked one.
  useEffect(() => {
    if (phone || countryPicked) return;
    let active = true;
    detectCountryIso().then((iso) => {
      if (active && !countryPicked) setCountryIso(iso);
    });
    return () => {
      active = false;
    };
  }, [phone, countryPicked]);

  const nameValid = nameInput.trim().length >= 2;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim());
  const phoneDigits = phoneInput.replace(/\D/g, "");
  const phoneValid = phoneDigits.length >= 7 && phoneDigits.length <= 15;
  const canContinue = nameValid && emailValid && phoneValid;

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    setTouched(true);
    if (!canContinue) return;
    const dial = countryByIso(countryIso)?.dial ?? "";
    setIdentity({
      name: nameInput,
      email: emailInput,
      phone: `${dial}${phoneDigits}`,
      phoneCountry: countryIso,
    });
    track("onboarding_step_completed", { step: "welcome" });
    syncLead("welcome");
    router.push("/onboarding/audience");
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
          Let&apos;s get the basics.
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-white/80">
          We&apos;ll use this to personalize the next few questions — no spam,
          no calls.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-10 flex flex-1 flex-col"
        noValidate
      >
        <div className="space-y-5 rounded-[20px] border border-gray-200/20 bg-white/40 backdrop-blur-3xl p-7">
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
          <PhoneInput
            label="Mobile number"
            placeholder="98765 43210"
            value={phoneInput}
            onChange={setPhoneInput}
            countryIso={countryIso}
            onCountryChange={(iso) => {
              setCountryPicked(true);
              setCountryIso(iso);
            }}
            error={
              touched && !phoneValid
                ? "Please enter a valid mobile number."
                : undefined
            }
          />
        </div>

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
