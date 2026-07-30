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

import type { BillingCycle } from "@/lib/store/onboarding";
import { courses } from "@/lib/data/courses.generated";

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
  /** What the subscription includes — the "included in this plan" group (PR-2). */
  included: string[];
  /** Paid extras bought on top of the subscription — the "add-ons" group (PR-2). */
  addOns: string[];
  /** Courses live on the platform today — included in every membership. */
  coursesLive: string[];
  /** Courses on the roadmap; included automatically when they launch. */
  coursesComingSoon: string[];
  /** Non-course inclusions (community, live Q&A, jobs feed, guidance). */
  whatElse: string[];
  /** Career Services bundled free with the annual plan. */
  careerServices: string[];
  /** Standalone value of Career Services, shown as "included free" on annual. */
  careerServicesValue: number;
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
      "Full library: every course included",
      "Bi-weekly live Q&A with practitioners",
      "40,000+ learner WhatsApp community",
      "Weekly industry insights & case studies",
      "Curated ESG jobs community access",
      "Personalised career guidance & resume review",
    ],
    included: [
      "Full library: every foundational course",
      "Certificate of completion for every course",
      "Bi-weekly live Q&A with practitioners",
      "40,000+ learner WhatsApp community",
      "Weekly industry insights & case studies",
      "Curated ESG jobs feed",
    ],
    addOns: [
      "Live certifications (e.g. ISO 14064)",
      "Workshops & masterclasses",
    ],
    coursesLive: [
      "Intro to ESG & BRSR",
      "ESG Mastery Program",
      "GHG Accounting",
      "Materiality Assessment",
      "Sustainable Finance",
      "ESG Reporting Bundle",
      "Carbon Footprinting",
      "ESG Software Tools",
    ],
    coursesComingSoon: [
      "AI for ESG",
      "Carbon Markets",
      "Climate Risk & TCFD",
      "Supply Chain & Scope 3",
      "Circular Economy",
      "ESG for Startups",
    ],
    whatElse: [
      "Bi-weekly live Q&A with industry experts",
      "WhatsApp learners community",
      "Weekly industry insights & case studies",
      "Curated ESG jobs community access",
      "Personalised career guidance",
      "Live certifications & workshops available as add-ons",
    ],
    careerServices: [
      "LinkedIn profile enrichment",
      "Resume building",
      "Statement of purpose (SoP) writing",
      "Pre-placement screening test",
      "Mock interviews with industry professionals",
      "Internship & job placement support",
      "Practical career roadmap & guidance",
      "Live certifications & workshops available as add-ons",
    ],
    careerServicesValue: 25000,
    ctaLabel: "Start membership",
  },
];

/**
 * Annual saves two months vs. paying monthly:
 *   (4000 × 12 − 44000) / (4000 × 12) ≈ 8.33%
 */
export const annualSavingsPercent = 8;

/**
 * Flat launch discount — a fixed ₹ amount off the first charge of BOTH billing
 * cycles, configured entirely via env so it can be changed (or switched off)
 * without a code change:
 *
 *   NEXT_PUBLIC_FLAT_DISCOUNT_INR — rupees off the first charge. Unset or 0
 *   disables the discount everywhere (cards render full price, no offer is
 *   attached at checkout).
 *
 * This drives only the price we *display*; the actual charge is discounted by
 * the Razorpay offers in RAZORPAY_OFFER_MONTHLY / RAZORPAY_OFFER_ANNUAL
 * (lib/razorpay/offers.ts). Keep the env amount equal to those dashboard
 * offers or the previewed price won't match what Razorpay charges.
 *
 * NEXT_PUBLIC_ vars are inlined at build time — changing the value requires a
 * redeploy, not just an env edit on a running instance.
 */
const rawDiscountInr = Number(process.env.NEXT_PUBLIC_FLAT_DISCOUNT_INR ?? 0);
const envDiscountInr = Number.isFinite(rawDiscountInr)
  ? Math.max(0, Math.round(rawDiscountInr))
  : 0;

export const flatDiscount: {
  /** Rupees off the first charge of each cycle (0 = discount off). */
  discountInr: number;
  /** Covers the first billing cycle only; full price thereafter. */
  firstCycleOnly: boolean;
  /** Shown when the offer is applied. */
  label: string;
} = {
  discountInr: envDiscountInr,
  firstCycleOnly: true,
  label: `Launch offer: ₹${envDiscountInr.toLocaleString("en-IN")} off`,
};

/**
 * First-charge price for a billing cycle after the flat discount, alongside the
 * original (struck-through) price. `active` is false when the discount is 0 (it
 * is clamped to the price so the result never goes negative).
 */
export function discountedPrice(
  plan: Plan,
  cycle: BillingCycle,
): { base: number; price: number; active: boolean } {
  const base = cycle === "annual" ? plan.priceAnnualTotal : plan.priceMonthly;
  const discount = Math.min(Math.max(flatDiscount.discountInr, 0), base);
  return { base, price: base - discount, active: discount > 0 };
}

/**
 * Value stack shown above the pricing cards (PR-1) — "what you're getting, and
 * what it would cost standalone."
 *
 * Course rows are derived from the generated catalog rather than hand-listed, so
 * this block and the course grid on the same page can't disagree. Every course
 * price is a real list price from the intake sheet; only the live-Q&A row is
 * still an estimate.
 * TODO[pricing]: confirm the annual live-Q&A value and drop its `estimated` flag.
 */
export interface ValueStackRow {
  label: string;
  /** Standalone INR value; null renders as "Included" (no standalone SKU). */
  value: number | null;
  /** True = best-effort estimate pending a confirmed price. */
  estimated?: boolean;
}

/** Named individually before the rest are grouped — keeps the card scannable. */
const VALUE_STACK_NAMED_COURSES = 6;

/** Non-course membership benefits, appended after the courses. */
const VALUE_STACK_EXTRAS: ValueStackRow[] = [
  {
    label: "Bi-weekly live Q&A with practitioners (a year)",
    value: 12000,
    estimated: true,
  },
  {
    label: "40,000+ community · weekly insights · curated jobs feed",
    value: null,
  },
];

/**
 * Free courses are skipped — a ₹0 row adds nothing to a standalone-value
 * argument. The grouped remainder is an exact sum, not an estimate, so it
 * carries no "est." marker.
 */
function buildValueStack(): { rows: ValueStackRow[]; total: number } {
  const priced = courses
    .filter((c) => c.includedInPlus && c.priceInr !== null && c.priceInr > 0)
    .sort((a, b) => (b.priceInr as number) - (a.priceInr as number));

  const named = priced.slice(0, VALUE_STACK_NAMED_COURSES);
  const rest = priced.slice(VALUE_STACK_NAMED_COURSES);
  const restTotal = rest.reduce((sum, c) => sum + (c.priceInr as number), 0);

  const rows: ValueStackRow[] = [
    ...named.map((c) => ({ label: c.title, value: c.priceInr })),
    ...(rest.length ? [{ label: `${rest.length} more courses`, value: restTotal }] : []),
    ...VALUE_STACK_EXTRAS,
  ];

  return { rows, total: rows.reduce((sum, r) => sum + (r.value ?? 0), 0) };
}

export const valueStack = buildValueStack();
