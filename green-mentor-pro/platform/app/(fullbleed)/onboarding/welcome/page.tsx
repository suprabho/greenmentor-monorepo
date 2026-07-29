"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useOnboarding, useOnboardingHydrated } from "@/lib/store/onboarding";
import { Input } from "@/components/onboarding/Input";
import { PhoneInput } from "@/components/onboarding/PhoneInput";
import { BottomNav } from "@/components/onboarding/BottomNav";
import { StepError } from "@/components/onboarding/StepError";
import { detectCountryIso } from "@/lib/utils/geo";
import { isValidName, isValidPhone, phoneLengthHint, toE164 } from "@/lib/utils/validation";
import { saveProfile } from "@/lib/onboarding/save";

export default function WelcomeStep() {
  const router = useRouter();
  const hydrated = useOnboardingHydrated();
  const { displayName, phone, phoneCountry, setIdentity } = useOnboarding();

  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [countryIso, setCountryIso] = useState(phoneCountry);
  // True once the user touches the picker — stops a late IP lookup from
  // overriding a deliberate choice.
  const [countryPicked, setCountryPicked] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the fields once the persisted draft (and the server hydration behind
  // it) has landed, so a resumed flow shows what was already answered.
  useEffect(() => {
    if (!hydrated) return;
    setNameInput((v) => v || displayName);
    setPhoneInput((v) => v || phone);
    setCountryIso((v) => (phone ? phoneCountry : v));
  }, [hydrated, displayName, phone, phoneCountry]);

  // Pre-fill the dial code from the visitor's IP unless we already have a
  // number saved or the user has picked a country themselves.
  useEffect(() => {
    if (!hydrated || phone || countryPicked) return;
    let active = true;
    detectCountryIso().then((iso) => {
      if (active && !countryPicked) setCountryIso(iso);
    });
    return () => {
      active = false;
    };
  }, [hydrated, phone, countryPicked]);

  const nameValid = isValidName(nameInput);
  const phoneValid = isValidPhone(phoneInput, countryIso);
  const canContinue = nameValid && phoneValid;

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    setTouched(true);
    if (!canContinue || saving) return;

    setSaving(true);
    setError(null);
    try {
      setIdentity({ displayName: nameInput, phone: phoneInput, phoneCountry: countryIso });
      await saveProfile({
        displayName: nameInput.trim(),
        phone: toE164(phoneInput, countryIso),
        phoneCountry: countryIso,
      });
      router.push("/onboarding/audience");
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
          Let&apos;s get the basics.
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-white/80">
          We&apos;ll use this to personalize the next few questions — no spam, no calls.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-10 flex flex-1 flex-col" noValidate>
        <div className="space-y-5 rounded-[20px] border border-gray-200/20 bg-white/40 p-7 backdrop-blur-3xl">
          <Input
            label="Full name"
            placeholder="Aanya Mehra"
            autoComplete="name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            error={touched && !nameValid ? "Please enter at least 2 characters." : undefined}
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
            error={touched && !phoneValid ? phoneLengthHint(countryIso) : undefined}
          />
        </div>

        <StepError message={error} />

        <BottomNav
          onContinue={handleSubmit}
          continueDisabled={touched && !canContinue}
          continueLoading={saving}
        />
      </form>
    </motion.div>
  );
}
