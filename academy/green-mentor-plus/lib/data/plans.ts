/**
 * Subscription plan for GM Academy.
 *
 * v3: single membership tier sold in two billing cycles (monthly / annual).
 * Prices reflect the Plus Essential reframe — ₹4,000/month or ₹44,000/year
 * (the annual saves two months and bundles Career Services).
 *
 * The `plans` array stays as an array of one — keeping the data shape lets
 * existing `.map` consumers (PricingSnapshot, checkout summary) work
 * unchanged, and leaves room for adding tiers later without restructuring.
 *
 * NOTE: changing `id` from "membership" will break the Razorpay env-var
 * lookup (`RAZORPAY_PLAN_${id.toUpperCase()}_${cycle}`). Keep it stable.
 */

export interface Plan {
  id: string;
  name: string;
  tagline: string;
  /** Per-month price when billed monthly. */
  priceMonthly: number;
  /** Per-month price when billed annually (annualTotal / 12, rounded). */
  priceAnnual: number;
  /** Total charged once at the annual checkout. Drives the "billed once"
   *  footnote so the displayed total stays clean (₹44,000) instead of the
   *  rounding-noisy `priceAnnual * 12`. */
  priceAnnualTotal: number;
  badge?: string;
  features: string[];
  ctaLabel: string;
  highlight?: boolean;
}

export const plans: Plan[] = [
  {
    id: "membership",
    name: "GM Academy Plus Essential",
    tagline:
      "One subscription. Every course, live sessions, the community, jobs feed and career guidance.",
    priceMonthly: 4000,
    priceAnnual: Math.round(44000 / 12),
    priceAnnualTotal: 44000,
    highlight: true,
    features: [
      "Full library — 8 courses, all included",
      "Bi-weekly live Q&A with practitioners",
      "40,000+ learner WhatsApp community",
      "Weekly industry insights & case studies",
      "Curated ESG jobs community access",
      "Personalised career guidance & resume review",
    ],
    ctaLabel: "Start membership",
  },
];

/**
 * Annual saves two months vs. paying monthly:
 *   (4000 × 12 − 44000) / (4000 × 12) ≈ 8.33%
 */
export const annualSavingsPercent = 8;
