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
      "Full library — 8 courses, all included",
      "Bi-weekly live Q&A with practitioners",
      "40,000+ learner WhatsApp community",
      "Weekly industry insights & case studies",
      "Curated ESG jobs community access",
      "Personalised career guidance & resume review",
    ],
    included: [
      "Full library — 8 foundational courses",
      "Bi-weekly live Q&A with practitioners",
      "40,000+ learner WhatsApp community",
      "Weekly industry insights & case studies",
      "Curated ESG jobs feed",
    ],
    addOns: [
      "Certification programs",
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
      "Certifications & workshops available as add-ons",
    ],
    careerServices: [
      "LinkedIn profile enrichment",
      "Resume building",
      "Statement of purpose (SoP) writing",
      "Pre-placement screening test",
      "Mock interviews with industry professionals",
      "Internship & job placement support",
      "Practical career roadmap & guidance",
      "Certifications & workshops available as add-ons",
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
 * Launch promo, as shown on the pricing surfaces (onboarding /plan step and the
 * marketing PricingSnapshot). The ACTUAL charge is driven by the Razorpay offer
 * resolved in lib/razorpay/promos.ts — whose `LAUNCH` registry entry derives its
 * numbers from here, so this is the single in-repo source for the promo's
 * customer-facing figures. Keep it equal to the live Razorpay offer.
 *
 * It's a first-month discount on the monthly cycle only; annual is unaffected.
 */
export const launchOffer: {
  /** Billing cycle the offer applies to. */
  cycle: BillingCycle;
  /** Rupees off the first charge. */
  discountInr: number;
  /** Covers the first billing cycle only; full price thereafter. */
  firstCycleOnly: boolean;
  /** Shown when the offer is applied. */
  label: string;
} = {
  cycle: "monthly",
  discountInr: 2000,
  firstCycleOnly: true,
  label: "Launch offer — first month for ₹2,000",
};

/**
 * Value stack shown above the pricing cards (PR-1) — "what you're getting, and
 * what it would cost standalone."
 *
 * Counts every INCLUDED item — all five named courses (the two premium live
 * programs, Live LCA ₹20,000 and ESG Reporting Pro ₹35,000, are now bundled
 * into the subscription and counted here), the rest of the library, and the
 * annual live Q&A.
 *
 * Rows flagged `estimated` are best-effort standalone values, shown with an
 * "est." marker in the UI and summed into a clearly-labelled *estimated* total.
 * TODO[pricing]: confirm the real Learnyst list prices for the 5 non-foundational
 * library courses and the annual live-Q&A value, then drop the `estimated` flags.
 */
export interface ValueStackRow {
  label: string;
  /** Standalone INR value; null renders as "Included" (no standalone SKU). */
  value: number | null;
  /** True = best-effort estimate pending a confirmed price. */
  estimated?: boolean;
}

export const valueStack: {
  rows: ValueStackRow[];
  /** Sum of the priced rows. Labelled "estimated" because some rows are. */
  total: number;
} = {
  rows: [
    { label: "Fundamentals of ESG & BRSR", value: 999 },
    { label: "GHG Accounting Mastery", value: 6999 },
    { label: "ESG Readiness", value: 6999 },
    { label: "Live Training — Master LCA", value: 20000 },
    { label: "Become an ESG Reporting Pro", value: 35000 },
    { label: "5 more foundational courses", value: 25000, estimated: true },
    {
      label: "Bi-weekly live Q&A with practitioners (a year)",
      value: 12000,
      estimated: true,
    },
    {
      label: "40,000+ community · weekly insights · curated jobs feed",
      value: null,
    },
  ],
  total: 999 + 6999 + 6999 + 20000 + 35000 + 25000 + 12000, // ₹106,997
};
