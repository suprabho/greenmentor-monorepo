"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { useOnboarding } from "@/lib/store/onboarding";
import { plan, annualSavingsPercent } from "@/lib/onboarding-data";
import { BottomNav } from "@/components/onboarding/BottomNav";
import { StepError } from "@/components/onboarding/StepError";
import { saveProfile } from "@/lib/onboarding/save";
import { cn } from "@/lib/utils/cn";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const CYCLES = [
  { id: "annual", label: "Annual", note: `save ${annualSavingsPercent}%` },
  { id: "monthly", label: "Monthly", note: null },
] as const;

export default function PlanStep() {
  const { planId, setPlan, billingCycle, setBillingCycle } = useOnboarding();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One membership tier — preselect it so Continue is live on arrival.
  useEffect(() => {
    if (!planId) setPlan(plan.id);
  }, [planId, setPlan]);

  async function handleFinish() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveProfile({
        planId: planId ?? plan.id,
        billingCycle,
        onboarded: true,
      });
      // Hard navigation: the gate in (app)/layout.tsx reads `onboarded` server
      // side, so we want a fresh render rather than a cached RSC payload that
      // would bounce us straight back here.
      window.location.assign("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  const price = billingCycle === "annual" ? plan.priceAnnualTotal : plan.priceMonthly;

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
      className="flex min-h-full flex-1 flex-col"
    >
      <div>
        <h1 className="font-display text-[40px] leading-tight tracking-[-0.02em] text-white md:text-[56px]">
          Choose your membership.
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-white/80">
          One tier, billed how you like. Payment is stubbed in this build — you won&apos;t be charged.
        </p>
      </div>

      <div className="mt-10 space-y-5">
        <div
          className="inline-flex rounded-pill border border-white/15 bg-white/10 p-1 text-[13px] font-semibold"
          role="group"
          aria-label="Billing cycle"
        >
          {CYCLES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={billingCycle === c.id}
              onClick={() => setBillingCycle(c.id)}
              className={cn(
                "rounded-pill px-4 py-1.5 transition-colors",
                billingCycle === c.id ? "bg-green-500 text-teal-900" : "text-white/70 hover:text-white",
              )}
            >
              {c.label}
              {c.note ? <span className="ml-1.5 font-medium">· {c.note}</span> : null}
            </button>
          ))}
        </div>

        <div className="flex flex-col justify-between gap-6 rounded-[20px] border border-green-500 bg-white/10 p-7 ring-2 ring-green-500 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-full bg-green-500">
                <Check size={14} weight="bold" className="text-teal-900" />
              </span>
              <h2 className="text-[20px] font-bold text-white">{plan.name}</h2>
            </div>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-white/70">{plan.tagline}</p>
          </div>
          <div className="shrink-0 sm:text-right">
            <div className="font-numeral text-[32px] font-bold leading-none text-white">
              {inr(price)}
            </div>
            <div className="mt-1 text-[13px] text-white/60">
              {billingCycle === "annual" ? "per year" : "per month"}
            </div>
          </div>
        </div>
      </div>

      <StepError message={error} />

      <BottomNav
        backHref="/onboarding/goals"
        onContinue={handleFinish}
        continueLabel="Finish & enter Green Mentor Pro"
        continueLoading={saving}
      />
    </motion.div>
  );
}
