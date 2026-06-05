/**
 * Promo-code registry — the server-side seam that maps a user-entered code to
 * a Razorpay offer id.
 *
 * Why a registry (and not just env vars keyed by code): a promo carries display
 * metadata (a human label, the discount we *show*, and which billing cycles it
 * applies to) that env vars alone can't express. The Razorpay offer (created in
 * Dashboard → Offers) remains the source of truth for the *actual* charge; the
 * `discount` here only drives the price we render before payment, so:
 *
 *   ⚠️  Keep `discount` in sync with the dashboard offer. If they drift, the
 *       previewed price won't match what Razorpay charges.
 *
 * Offer ids differ between test and live accounts, so they live in env vars
 * (`offerEnvKey`) rather than in the repo — same rationale as the plan ids in
 * config.ts. A code whose env var is unset is treated as "not configured" and
 * silently unavailable, so shipping a code ahead of its offer is safe.
 */

import type { BillingCycle } from "@/lib/store/onboarding";

export interface PromoDiscount {
  /** `percent`: 0–100 off. `flat`: a fixed number of paise off. */
  type: "percent" | "flat";
  value: number;
}

interface PromoDefinition {
  /** Normalised, uppercase alphanumeric. Acts as an internal identifier and,
   *  unless `autoApply`, is what the user types (`normalizePromoCode`). */
  code: string;
  /** Shown to the user when the code is applied, e.g. "20% off your first year". */
  label: string;
  /** Env var holding the Razorpay `offer_…` id for this code. */
  offerEnvKey: string;
  discount: PromoDiscount;
  /** Restrict to certain billing cycles; omit to allow all. */
  cycles?: BillingCycle[];
  /** Attach automatically (no typed code) when the cycle matches — for sitewide
   *  launch offers. Shown as a non-removable badge. The first configured + env-set
   *  auto promo for a cycle wins. */
  autoApply?: boolean;
  /** Discount applies to the first billing cycle only (full price after). Drives
   *  the "then ₹X/cycle" note so the recurring price stays clear. */
  firstCycleOnly?: boolean;
}

/**
 * Add codes here. Each needs a matching Razorpay offer (Dashboard → Offers)
 * and its id dropped into the named env var. Example:
 *
 *   {
 *     code: "WELCOME20",
 *     label: "20% off your first payment",
 *     offerEnvKey: "RAZORPAY_OFFER_WELCOME20",
 *     discount: { type: "percent", value: 20 },
 *   }
 */
const PROMO_DEFINITIONS: PromoDefinition[] = [
  {
    // "GreenMentor Plus Launch Offer" — auto-applies, no code to type.
    code: "LAUNCH", // internal identifier (offer auto-applies)
    label: "Launch offer — first month for ₹2,000", // shown when applied
    offerEnvKey: "RAZORPAY_OFFER_WELCOME20", // env var holding your offer id
    // ₹2,000 off, in PAISE (plan amount is in paise). Mirrors the dashboard
    // offer's flat ₹2,000 discount.
    discount: { type: "flat", value: 200000 },
    // Offer terms: monthly-only, first billing cycle only.
    cycles: ["monthly"],
    autoApply: true,
    firstCycleOnly: true,
  },
];

export type PromoRejection =
  | "unknown" // no code matches
  | "not_configured" // code exists but its offer-id env var is unset
  | "wrong_cycle"; // code isn't valid for the selected billing cycle

export interface ResolvedPromo {
  code: string;
  label: string;
  offerId: string;
  discount: PromoDiscount;
  /** True when applied automatically (launch offer) — non-removable in the UI. */
  auto: boolean;
  /** True when the discount only covers the first billing cycle. */
  firstCycleOnly: boolean;
}

/** Strip whitespace/punctuation and upper-case so "welcome-20" === "WELCOME20". */
export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Validate a user-entered code against the registry + env + selected cycle.
 * Returns the resolved offer (with its id pulled from env) or a typed reason.
 */
export function resolvePromoCode(
  raw: string,
  cycle: BillingCycle,
): { ok: true; promo: ResolvedPromo } | { ok: false; reason: PromoRejection } {
  const code = normalizePromoCode(raw);
  const def = PROMO_DEFINITIONS.find((p) => p.code === code);
  if (!def) return { ok: false, reason: "unknown" };
  if (def.cycles && !def.cycles.includes(cycle)) {
    return { ok: false, reason: "wrong_cycle" };
  }
  const offerId = process.env[def.offerEnvKey];
  if (!offerId) return { ok: false, reason: "not_configured" };
  return { ok: true, promo: toResolved(def, offerId) };
}

/**
 * Find the auto-applying promo for a cycle (no typed code). Returns the first
 * `autoApply` definition that matches the cycle and has its offer-id env var
 * set, or undefined when none applies (→ full price).
 */
export function resolveAutoPromo(cycle: BillingCycle): ResolvedPromo | undefined {
  for (const def of PROMO_DEFINITIONS) {
    if (!def.autoApply) continue;
    if (def.cycles && !def.cycles.includes(cycle)) continue;
    const offerId = process.env[def.offerEnvKey];
    if (!offerId) continue;
    return toResolved(def, offerId);
  }
  return undefined;
}

function toResolved(def: PromoDefinition, offerId: string): ResolvedPromo {
  return {
    code: def.code,
    label: def.label,
    offerId,
    discount: def.discount,
    auto: def.autoApply === true,
    firstCycleOnly: def.firstCycleOnly === true,
  };
}

/** Apply a discount to a paise amount, floored at zero. */
export function applyPromoDiscount(
  amountPaise: number,
  discount: PromoDiscount,
): number {
  const discounted =
    discount.type === "percent"
      ? Math.round(amountPaise * (1 - discount.value / 100))
      : amountPaise - discount.value;
  return Math.max(0, discounted);
}

/** User-facing copy for a rejection reason — both `unknown` and the rarer
 *  `not_configured` collapse to the same vague message so we never reveal which
 *  codes exist-but-aren't-live. */
export function promoRejectionMessage(reason: PromoRejection): string {
  switch (reason) {
    case "wrong_cycle":
      return "That code doesn't apply to this billing cycle.";
    case "unknown":
    case "not_configured":
    default:
      return "That code isn't valid.";
  }
}
