"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { useOnboarding, type BillingCycle } from "@/lib/store/onboarding";
import { plans, annualSavingsPercent } from "@/lib/data/plans";
import { Badge, Eyebrow } from "@/components/ui/Badge";
import { BottomNav } from "@/components/onboarding/BottomNav";
import { cn } from "@/lib/utils/cn";
import { track } from "@/lib/utils/analytics";

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

// Single-membership world: the only choice on this step is the billing cycle.
// The two cards below ARE the two cycles, so the old monthly/annual toggle
// is gone — the cards do double duty as choice + summary.
export default function PlanStep() {
  const router = useRouter();
  const { planId, billingCycle, setPlan, setBillingCycle } = useOnboarding();
  const plan = plans[0];

  // `planId` doubles as the "user has interacted" flag — until they click a
  // card we don't have a selection. Default billingCycle stays `annual` in
  // the store so we can show that card visually pre-highlighted.
  const canContinue = !!planId;

  function handleSelect(cycle: BillingCycle) {
    setPlan(plan.id);
    setBillingCycle(cycle);
  }

  function handleContinue() {
    if (!canContinue) return;
    track("onboarding_step_completed", {
      step: "plan",
      planId,
      billingCycle,
    });
    router.push("/onboarding/checkout");
  }

  const isSelected = (cycle: BillingCycle) =>
    planId === plan.id && billingCycle === cycle;

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <Eyebrow tone="white">Membership</Eyebrow>
      <h1 className="font-display mt-8 text-[40px] leading-tight tracking-[-0.02em] text-ink md:text-[56px]">
        Pick how you want to pay.
      </h1>
      <p className="mt-4 text-[17px] leading-relaxed text-gray-700">
        One membership, two billing options. Cancel anytime before your next
        cycle — no questions, no friction.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {/* Monthly */}
        <button
          type="button"
          onClick={() => handleSelect("monthly")}
          aria-pressed={isSelected("monthly")}
          className={cn(
            "group relative flex flex-col rounded-[20px] border bg-white p-7 text-left transition-[border-color,box-shadow,transform] duration-200",
            "hover:-translate-y-0.5 hover:shadow-lift",
            isSelected("monthly")
              ? "border-green-700 shadow-lift"
              : "border-gray-200 hover:border-green-700",
          )}
        >
          <div>
            <h3 className="text-[22px] font-bold text-ink">Monthly</h3>
            <p className="mt-1 text-[14px] text-gray-700">
              Billed every month. Cancel any time.
            </p>
          </div>

          <div className="mt-5 flex items-baseline gap-2">
            <span className="font-numeral text-[40px] leading-none text-green-700">
              {formatINR(plan.priceMonthly)}
            </span>
            <span className="text-[13px] text-gray-500">/ month</span>
          </div>

          <p className="mt-5 border-t border-gray-200 pt-5 text-[13px] text-gray-500">
            Same access. Try it without the annual commit.
          </p>
        </button>

        {/* Annual */}
        <button
          type="button"
          onClick={() => handleSelect("annual")}
          aria-pressed={isSelected("annual")}
          className={cn(
            "group relative flex flex-col rounded-[20px] border bg-white p-7 text-left transition-[border-color,box-shadow,transform] duration-200",
            "hover:-translate-y-0.5 hover:shadow-lift",
            isSelected("annual")
              ? "border-green-700 shadow-lift"
              : "border-gray-200 hover:border-green-700",
          )}
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[22px] font-bold text-ink">Annual</h3>
              <p className="mt-1 text-[14px] text-gray-700">
                Billed once a year. Best value.
              </p>
            </div>
            <Badge tone="neon">Save {annualSavingsPercent}%</Badge>
          </div>

          <div className="mt-5 flex items-baseline gap-2">
            <span className="font-numeral text-[40px] leading-none text-green-700">
              {formatINR(plan.priceAnnual)}
            </span>
            <span className="text-[13px] text-gray-500">
              / month, billed yearly
            </span>
          </div>

          <p className="mt-5 border-t border-gray-200 pt-5 text-[13px] text-gray-500">
            {formatINR(plan.priceAnnual * 12)} billed once · works out to{" "}
            {formatINR(plan.priceMonthly - plan.priceAnnual)} saved per month.
          </p>
        </button>
      </div>

      {/* Shared features — identical for both cycles, so we only list them
          once instead of repeating them inside each card. */}
      <div className="mt-12 rounded-[20px] border border-gray-200 bg-white p-7">
        <h2 className="text-[15px] font-bold tracking-wide text-green-700 uppercase">
          What&apos;s included
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {plan.features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2 text-[14px] text-ink"
            >
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-green-500">
                <Check size={12} weight="bold" className="text-teal-900" />
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <BottomNav
        backHref="/onboarding/goals"
        onContinue={handleContinue}
        continueDisabled={!canContinue}
        continueLabel="Continue to Checkout"
      />
    </motion.div>
  );
}
