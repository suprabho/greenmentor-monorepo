"use client";

import Link from "next/link";
import {
  Check,
  Plus,
  ShieldCheck,
  Lock,
  ArrowCounterClockwise,
  Lightning,
  Gift,
} from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { plans, annualSavingsPercent, valueStack } from "@/lib/data/plans";
import { guarantee } from "@/lib/data/guarantee";
import { cn } from "@/lib/utils/cn";
import { track } from "@/lib/utils/analytics";

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

interface PricingSnapshotProps {
  compact?: boolean;
}

// Marketing-side pricing block. Mirrors the onboarding /plan step: one
// membership, two side-by-side billing-cycle cards. Each card deep-links to
// /onboarding/welcome with both plan + cycle preselected so the onboarding
// store can skip ahead.
export function PricingSnapshot({ compact = false }: PricingSnapshotProps) {
  const plan = plans[0];

  const cycleCards = [
    {
      cycle: "monthly" as const,
      title: "Monthly",
      subtitle: "Billed every month. Cancel anytime.",
      price: plan.priceMonthly,
      priceSuffix: "/ month",
      footnote: "Same access. Try it without the annual commit.",
      highlight: false,
      badge: null as string | null,
      ctaLabel: "Get instant access — ₹4,000 / month",
    },
    {
      cycle: "annual" as const,
      title: "Annual",
      subtitle: `Everything in monthly, plus the ${formatINR(plan.careerServicesValue)} Career Services bundle — free.`,
      price: plan.priceAnnual,
      priceSuffix: "/ month, billed yearly",
      footnote: `${formatINR(plan.priceAnnualTotal)} billed once a year · Save ${annualSavingsPercent}% vs monthly.`,
      highlight: true,
      badge: "Career Services included",
      ctaLabel: "Get Plus Annual + Career Services — ₹44,000 / year",
    },
  ];

  return (
    <section
      id="pricing"
      className={cn("bg-section-fade", compact ? "py-20" : "py-24 md:py-28")}
    >
      <Container width="wide">
        <SectionHeader
          label="Pricing"
          title={
            <>
              One subscription.{" "}
              <span className="text-green-700">Whole library.</span>
            </>
          }
          description={`Pick how you want to be billed. Annual saves ${annualSavingsPercent}% and bundles Career Services. Cancel anytime before your next cycle.`}
          align="center"
          className="text-center"
        />

        {/* PR-1 — value stack: what's included, and what it would cost standalone.
            Included items only (add-ons are deliberately excluded — see plans.ts). */}
        <div className="mx-auto mt-12 max-w-2xl rounded-[20px] border border-gray-200 bg-white p-6 shadow-soft md:p-8">
          <p className="gm-eyebrow text-green-700">What you&apos;re getting</p>
          <h3 className="mt-2 text-[20px] font-bold text-ink">
            And what it would cost you standalone
          </h3>
          <ul className="mt-5 divide-y divide-gray-100">
            {valueStack.rows.map((row) => (
              <li
                key={row.label}
                className="flex items-baseline justify-between gap-4 py-2.5 text-[15px]"
              >
                <span className="text-gray-700">
                  {row.label}
                  {row.estimated ? (
                    <span className="ml-1.5 text-[12px] text-gray-400">
                      est.
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 font-semibold text-ink">
                  {row.value === null ? (
                    <span className="text-green-700">Included</span>
                  ) : (
                    formatINR(row.value)
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-gray-200 pt-3 text-[15px]">
            <span className="font-semibold text-ink">
              Standalone value (est.)
            </span>
            <span className="font-bold text-ink">
              ~{formatINR(valueStack.total)}
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-4 rounded-[12px] bg-green-100 px-4 py-3">
            <span className="text-[15px] font-bold text-green-700">
              Your cost as a Plus member
            </span>
            <span className="font-numeral text-[22px] leading-none text-green-700">
              {formatINR(plan.priceMonthly)}{" "}
              <span className="text-[13px] font-medium text-green-700/80">
                / month
              </span>
            </span>
          </div>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
          {cycleCards.map((card) => (
            <div
              key={card.cycle}
              className={cn(
                "relative flex flex-col rounded-[20px] border bg-white p-8",
                card.highlight
                  ? "border-green-700 shadow-lift"
                  : "border-gray-200",
              )}
            >
              {card.badge ? (
                <span className="absolute -top-3 left-8">
                  <Badge tone="neon">{card.badge}</Badge>
                </span>
              ) : null}

              <div>
                <h3 className="text-[28px] font-bold text-ink">{card.title}</h3>
                <p className="mt-2 text-[15px] text-gray-700">
                  {card.subtitle}
                </p>
              </div>

              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-numeral text-[56px] leading-none text-green-700">
                  {formatINR(card.price)}
                </span>
                <span className="text-[13px] text-gray-500">
                  {card.priceSuffix}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-gray-500">{card.footnote}</p>

              {/* PR-2 — included vs add-on, made explicit on the card itself */}
              <div className="mt-6 border-t border-gray-200 pt-6">
                <p className="gm-eyebrow text-green-700">Included in this plan</p>
                <ul className="mt-4 space-y-3">
                  {plan.included.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-3 text-[15px] text-ink"
                    >
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-green-500">
                        <Check
                          size={12}
                          weight="bold"
                          className="text-teal-900"
                        />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                  {card.cycle === "annual" ? (
                    <li className="flex items-start gap-3 rounded-[10px] bg-green-100 px-3 py-2.5 text-[15px] font-semibold text-green-700">
                      <Gift
                        size={18}
                        weight="duotone"
                        className="mt-0.5 shrink-0"
                        aria-hidden
                      />
                      <span>
                        Career Services bundle (
                        {formatINR(plan.careerServicesValue)}) — included free
                      </span>
                    </li>
                  ) : null}
                </ul>

                <p className="mt-6 gm-eyebrow text-gray-500">
                  Available as add-ons
                </p>
                <ul className="mt-4 space-y-3">
                  {plan.addOns.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-3 text-[15px] text-gray-600"
                    >
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-gray-300">
                        <Plus
                          size={11}
                          weight="bold"
                          className="text-gray-500"
                        />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/#courses"
                  className="mt-3 inline-flex text-[13px] font-semibold text-green-700 underline-offset-4 hover:underline"
                >
                  See all add-ons →
                </Link>
              </div>

              <div className="mt-8">
                <Button
                  asChild
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  <Link
                    href={`/onboarding/welcome?plan=${plan.id}&cycle=${card.cycle}`}
                    onClick={() =>
                      track("pricing_cta_clicked", {
                        plan: plan.id,
                        cycle: card.cycle,
                      })
                    }
                  >
                    {card.ctaLabel}
                  </Link>
                </Button>
                <p className="mt-3 text-center text-[12px] text-gray-500">
                  {guarantee.short}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* PR-4 — trust strip, guarantee anchored as the most prominent item */}
        <div className="mx-auto mt-10 max-w-4xl">
          <div className="flex items-center justify-center gap-2.5 rounded-[14px] bg-green-100 px-5 py-3 text-center">
            <ShieldCheck
              size={20}
              weight="fill"
              className="shrink-0 text-green-700"
              aria-hidden
            />
            <span className="text-[15px] font-semibold text-green-700">
              {guarantee.label} — no questions asked
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <Lock size={14} weight="bold" aria-hidden /> Secure payment via
              Razorpay
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ArrowCounterClockwise size={14} weight="bold" aria-hidden />{" "}
              Cancel before next cycle
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lightning size={14} weight="bold" aria-hidden /> Instant access
              after payment
            </span>
          </div>
        </div>

        {/* G-1 — name the delivery platform + device availability */}
        <p className="mx-auto mt-6 max-w-2xl text-center text-[13px] text-gray-500">
          Courses delivered on GreenMentor Academy, powered by Learnyst —
          accessible on web, iOS, and Android.
        </p>
      </Container>
    </section>
  );
}
