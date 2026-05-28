"use client";

import Link from "next/link";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { plans, annualSavingsPercent } from "@/lib/data/plans";
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
      subtitle: "Billed every month. Cancel any time.",
      price: plan.priceMonthly,
      priceSuffix: "/ month",
      footnote: "Same access. Try it without the annual commit.",
      highlight: false,
      ctaLabel: "Start monthly",
    },
    {
      cycle: "annual" as const,
      title: "Annual",
      subtitle: "Billed once a year. Adds Career Services. Best value.",
      price: plan.priceAnnual,
      priceSuffix: "/ month, billed yearly",
      footnote: `${formatINR(plan.priceAnnualTotal)} billed once · ${formatINR(plan.priceMonthly - plan.priceAnnual)} saved per month.`,
      highlight: true,
      ctaLabel: "Start annual",
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

        <div className="mx-auto mt-16 grid max-w-4xl gap-6 md:grid-cols-2">
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
              {card.highlight ? (
                <span className="absolute -top-3 left-8">
                  <Badge tone="neon">Save {annualSavingsPercent}%</Badge>
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

              <ul className="mt-6 space-y-3 border-t border-gray-200 pt-6">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-[15px] text-ink"
                  >
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-green-500">
                      <Check size={12} weight="bold" className="text-teal-900" />
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Button
                  asChild
                  variant={card.highlight ? "primary" : "outline"}
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
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
