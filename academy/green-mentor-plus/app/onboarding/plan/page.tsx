"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Clock, CaretDown } from "@phosphor-icons/react/dist/ssr";
import { useOnboarding, type BillingCycle } from "@/lib/store/onboarding";
import { plans, flatDiscount, discountedPrice } from "@/lib/data/plans";
import { Badge } from "@/components/ui/Badge";
import { BottomNav } from "@/components/onboarding/BottomNav";
import { cn } from "@/lib/utils/cn";
import { track } from "@/lib/utils/analytics";
import { syncLead } from "@/lib/lead/sync";

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Small uppercase section label used inside the cards. `onDark` switches the
 *  palette for the translucent shared panel that sits on the teal background. */
function SectionLabel({
  children,
  muted,
  onDark,
}: {
  children: React.ReactNode;
  muted?: boolean;
  onDark?: boolean;
}) {
  return (
    <h4
      className={cn(
        "text-[12px] font-bold tracking-wide uppercase",
        muted
          ? onDark
            ? "text-white/55"
            : "text-gray-500"
          : onDark
            ? "text-green-400"
            : "text-green-700",
      )}
    >
      {children}
    </h4>
  );
}

/** Inclusion list — `check` items are confirmed, `coming` items are roadmap.
 *  `onDark` switches the palette for the translucent shared panel. */
function InclusionList({
  items,
  variant = "check",
  columns = 1,
  onDark = false,
}: {
  items: string[];
  variant?: "check" | "coming";
  columns?: 1 | 2;
  onDark?: boolean;
}) {
  return (
    <ul className={cn("mt-3 grid gap-2", columns === 2 && "sm:grid-cols-2")}>
      {items.map((item) => (
        <li
          key={item}
          className={cn(
            "flex items-start gap-2 text-[14px]",
            variant === "coming"
              ? onDark
                ? "text-white/55"
                : "text-gray-600"
              : onDark
                ? "text-white"
                : "text-ink",
          )}
        >
          {variant === "coming" ? (
            <span
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border",
                onDark ? "border-white/30" : "border-gray-300",
              )}
            >
              <Clock
                size={11}
                className={onDark ? "text-white/45" : "text-gray-400"}
              />
            </span>
          ) : (
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-green-500">
              <Check size={12} weight="bold" className="text-teal-900" />
            </span>
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Price row with the flat discount shown inline when active: the discounted
 *  first-charge amount, the original struck through, and a "₹X off" pill. Used
 *  on both cards so the discount reads identically across cycles. */
function PriceRow({
  amount,
  base,
  active,
  suffix,
}: {
  amount: number;
  base: number;
  active: boolean;
  suffix: string;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="font-numeral text-[40px] leading-none text-green-700">
        {formatINR(amount)}
      </span>
      <span className="text-[13px] text-gray-500">{suffix}</span>
      {active && (
        <>
          <span className="font-numeral text-[18px] leading-none text-gray-400 line-through">
            {formatINR(base)}
          </span>
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-[12px] font-bold text-green-700">
            {formatINR(base - amount)} off
          </span>
        </>
      )}
    </div>
  );
}

// Single-membership world: the only choice on this step is the billing cycle.
// The two cards below ARE the two cycles — monthly is Plus Essential, annual
// bundles Career Services free, so each card carries its own full inclusions.
export default function PlanStep() {
  const router = useRouter();
  const { planId, billingCycle, setPlan, setBillingCycle } = useOnboarding();
  const plan = plans[0];

  // Pre-select on first arrival so a card lands already chosen and Continue is
  // live. We only seed `planId` (not the cycle) when nothing's picked yet, so
  // the store's default cycle wins — that's `annual`, the "Best value" card —
  // while still respecting a monthly deep-link (?cycle=monthly) or a returning
  // user's earlier choice.
  useEffect(() => {
    if (!planId) setPlan(plan.id);
  }, [planId, plan.id, setPlan]);

  // `planId` doubles as the "user has interacted" flag — seeded above so the
  // default (annual) card shows pre-highlighted on load.
  const canContinue = !!planId;

  // Flat launch discount applied to each cycle's first charge (see
  // `flatDiscount`). Drives the strike-through + "₹X off" pill on both cards.
  const monthly = discountedPrice(plan, "monthly");
  const annual = discountedPrice(plan, "annual");

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
    syncLead("plan");
    router.push("/onboarding/checkout");
  }

  const isSelected = (cycle: BillingCycle) =>
    planId === plan.id && billingCycle === cycle;

  // Once a card is picked, surface the amount they'll be charged on the CTA so
  // the price carries through to checkout — the discounted first charge,
  // matching the card and the checkout total.
  const checkoutAmount =
    billingCycle === "annual" ? annual.price : monthly.price;
  const continueLabel = canContinue
    ? `Continue to Checkout · ${formatINR(checkoutAmount)}`
    : "Continue to Checkout";

  const cardClass = (selected: boolean) =>
    cn(
      "group relative flex flex-col rounded-[12px] border bg-white p-7 text-left transition-[border-color,box-shadow,transform] duration-200",
      "hover:-translate-y-0.5 hover:shadow-lift",
      selected
        ? "-translate-y-0.5 border-green-700 bg-green-50 shadow-lift ring-2 ring-green-700"
        : "border-gray-200 hover:border-green-700",
    );

  // On mobile each card's inclusions collapse until the card is selected, so
  // the list reads as two compact options. On desktop (md+) both stay open.
  const detailsClass = (selected: boolean) =>
    cn(
      "grid transition-[grid-template-rows] duration-300 ease-out md:grid-rows-[1fr]",
      selected ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
    );

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
      className="flex min-h-full flex-1 flex-col"
    >
      <div>
        <h1 className="font-display text-[40px] leading-tight tracking-[-0.02em] text-white md:text-[56px]">
          Pick how you want to pay.
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-white/80">
          One membership, two billing options. The annual plan bundles Career
          Services free — cancel anytime before your next cycle.
        </p>

        <div className="mt-10 grid items-center gap-5 md:grid-cols-2">
          {/* Monthly — Plus Essential */}
          <button
            type="button"
            onClick={() => handleSelect("monthly")}
            aria-pressed={isSelected("monthly")}
            className={cardClass(isSelected("monthly"))}
          >
            <div>
              <h3 className="text-[22px] font-bold text-ink">Plus Essential</h3>
              <p className="mt-1 text-[14px] text-gray-700">
                Full access to all ESG courses, live expert sessions & career
                community
              </p>
            </div>

            <PriceRow
              amount={monthly.price}
              base={monthly.base}
              active={monthly.active}
              suffix={monthly.active ? "first month" : "/ month"}
            />
            <p className="mt-1 text-[13px] text-gray-500">
              {monthly.active && flatDiscount.firstCycleOnly
                ? `Then ${formatINR(plan.priceMonthly)} / month · Incl. GST`
                : "Incl. GST"}
            </p>

            <div className="mt-6 border-t border-gray-200 pt-5">
              <SectionLabel>What else is included</SectionLabel>
              <InclusionList items={plan.whatElse} />
            </div>
          </button>

          {/* Annual — Plus Essential + Career (best value) */}
          <button
            type="button"
            onClick={() => handleSelect("annual")}
            aria-pressed={isSelected("annual")}
            className={cardClass(isSelected("annual"))}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[22px] font-bold text-ink">
                  Plus Essential + Career
                </h3>
                <p className="mt-1 text-[14px] text-gray-700">
                  Everything in monthly, with Career Services bundled — resume,
                  mock interviews & placement support
                </p>
              </div>
              <Badge tone="neon" className="shrink-0 whitespace-nowrap">
                Best value
              </Badge>
            </div>

            <PriceRow
              amount={annual.price}
              base={annual.base}
              active={annual.active}
              suffix={annual.active ? "first year" : "/ year"}
            />
            <p className="mt-1 text-[13px] font-semibold text-green-700">
              Career Services ({formatINR(plan.careerServicesValue)}) included
              free
            </p>
            <p className="text-[13px] text-gray-500">
              {annual.active && flatDiscount.firstCycleOnly
                ? `Renews at ${formatINR(plan.priceAnnualTotal)} / year · Incl. GST`
                : `Incl. GST · equiv. ${formatINR(plan.priceAnnual)}/month`}
            </p>

            <div className="mt-6 border-t border-gray-200 pt-5">
              <SectionLabel>Career Services — bundled free</SectionLabel>
              <InclusionList items={plan.careerServices} />
            </div>
          </button>
        </div>

        {/* Courses are identical across both billing options, so they live in
            one shared panel rather than being repeated inside each card. */}
        <div className="mt-5 rounded-[12px] border border-white/15 bg-white/10 p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <SectionLabel onDark>Courses included — live now</SectionLabel>
            <span className="text-[13px] text-white/55">
              Included in both plans
            </span>
          </div>
          <InclusionList items={plan.coursesLive} columns={2} onDark />

          <div className="mt-5">
            <SectionLabel muted onDark>
              Coming soon
            </SectionLabel>
            <InclusionList
              items={plan.coursesComingSoon}
              variant="coming"
              columns={2}
              onDark
            />
          </div>
        </div>
      </div>

      <BottomNav
        backHref="/onboarding/goals"
        onContinue={handleContinue}
        continueDisabled={!canContinue}
        continueLabel={continueLabel}
      />
    </motion.div>
  );
}
