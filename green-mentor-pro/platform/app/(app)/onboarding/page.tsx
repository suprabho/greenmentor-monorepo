"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "@phosphor-icons/react";
import { clsx } from "clsx";
import { useOnboarding } from "@/lib/store/onboarding";
import { audiences, goals, plan, annualSavingsPercent } from "@/lib/onboarding-data";

const STEPS = ["You", "Goals", "Plan"] as const;
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function OnboardingWizard() {
  const router = useRouter();
  const {
    segment, setSegment,
    goals: chosenGoals, toggleGoal,
    planId, setPlan,
    billingCycle, setBillingCycle,
  } = useOnboarding();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = step === 0 ? !!segment : step === 1 ? chosenGoals.length > 0 : !!planId;

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ segment, goals: chosenGoals, planId, billingCycle }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      // Land in the app proper, not the marketing landing page.
      router.push("/feed");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-7 py-2">
      {/* stepper */}
      <ol className="flex items-center gap-2 text-[12.5px] font-semibold">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span className={clsx(
              "grid size-6 place-items-center rounded-full text-[11px]",
              i < step ? "bg-green-700 text-white" : i === step ? "bg-teal-900 text-white" : "bg-gray-200 text-gray-500",
            )}>
              {i < step ? <Check size={13} weight="bold" /> : i + 1}
            </span>
            <span className={i === step ? "text-ink" : "text-gray-500"}>{label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-gray-200" />}
          </li>
        ))}
      </ol>

      {/* STEP 0 — audience */}
      {step === 0 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-ink">Where are you right now?</h1>
            <p className="mt-1 text-[14px] text-gray-600">Pick the path that maps best — it tunes what we show you.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {audiences.map((a) => {
              const active = segment === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setSegment(a.id)}
                  className={clsx(
                    "flex flex-col rounded-[16px] border p-4 text-left transition-colors",
                    active ? "border-teal-900 bg-teal-900/[0.03] ring-1 ring-teal-900" : "border-gray-200 bg-white hover:border-gray-300",
                  )}
                >
                  <a.icon size={24} weight={active ? "fill" : "regular"} className={active ? "text-teal-900" : "text-gray-500"} />
                  <span className="mt-3 text-[14.5px] font-semibold text-ink">{a.label}</span>
                  <span className="mt-0.5 text-[12.5px] font-medium text-green-700">{a.tagline}</span>
                  <span className="mt-2 text-[12.5px] leading-relaxed text-gray-600">{a.description}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* STEP 1 — goals */}
      {step === 1 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-ink">What would success look like in 3 months?</h1>
            <p className="mt-1 text-[14px] text-gray-600">Pick anything that resonates — at least one.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {goals.map((g) => {
              const active = chosenGoals.includes(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => toggleGoal(g.id)}
                  className={clsx(
                    "rounded-pill border px-4 py-2 text-[13px] font-medium transition-colors",
                    active ? "border-green-700 bg-green-50 text-green-700" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300",
                  )}
                >
                  {active && <Check size={13} weight="bold" className="mr-1.5 inline" />}
                  {g.label}
                </button>
              );
            })}
          </div>
          <p className="text-[12.5px] text-gray-500">
            {chosenGoals.length === 0 ? "Pick at least one goal to continue." : `${chosenGoals.length} selected.`}
          </p>
        </section>
      )}

      {/* STEP 2 — plan (checkout stubbed) */}
      {step === 2 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-ink">Choose your membership</h1>
            <p className="mt-1 text-[14px] text-gray-600">One tier, billed how you like. Payment is stubbed in this build.</p>
          </div>

          <div className="inline-flex rounded-pill border border-gray-200 bg-gray-50 p-1 text-[12.5px] font-semibold">
            {(["annual", "monthly"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setBillingCycle(c)}
                className={clsx("rounded-pill px-3.5 py-1.5 capitalize", billingCycle === c ? "bg-teal-900 text-white" : "text-gray-600")}
              >
                {c}{c === "annual" && <span className="ml-1 text-green-500">· save {annualSavingsPercent}%</span>}
              </button>
            ))}
          </div>

          <button
            onClick={() => setPlan(plan.id)}
            className={clsx(
              "flex w-full items-start justify-between rounded-[18px] border p-5 text-left transition-colors",
              planId === plan.id ? "border-teal-900 ring-1 ring-teal-900" : "border-gray-200 hover:border-gray-300",
            )}
          >
            <div>
              <div className="text-[15px] font-semibold text-ink">{plan.name}</div>
              <div className="mt-1 max-w-md text-[13px] text-gray-600">{plan.tagline}</div>
            </div>
            <div className="text-right">
              {billingCycle === "annual" ? (
                <>
                  <div className="text-[22px] font-bold text-ink">{inr(plan.priceAnnualTotal)}</div>
                  <div className="text-[12px] text-gray-500">per year</div>
                </>
              ) : (
                <>
                  <div className="text-[22px] font-bold text-ink">{inr(plan.priceMonthly)}</div>
                  <div className="text-[12px] text-gray-500">per month</div>
                </>
              )}
            </div>
          </button>
        </section>
      )}

      {error && <p className="rounded-[10px] bg-red-50 px-3 py-2 text-[12.5px] text-danger">{error}</p>}

      {/* nav */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-5">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="text-[13px] font-semibold text-gray-500 hover:text-ink disabled:opacity-0"
        >
          ← Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canContinue}
            className="rounded-pill bg-teal-900 px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={finish}
            disabled={!canContinue || saving}
            className="rounded-pill bg-green-700 px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-green-700/90 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Finish & enter Green Mentor Pro"}
          </button>
        )}
      </div>
    </div>
  );
}
