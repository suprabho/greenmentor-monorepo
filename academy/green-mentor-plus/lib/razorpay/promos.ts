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
  /** Normalised, uppercase alphanumeric — compared against `normalizePromoCode`. */
  code: string;
  /** Shown to the user when the code is applied, e.g. "20% off your first year". */
  label: string;
  /** Env var holding the Razorpay `offer_…` id for this code. */
  offerEnvKey: string;
  discount: PromoDiscount;
  /** Restrict to certain billing cycles; omit to allow all. */
  cycles?: BillingCycle[];
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
const PROMO_DEFINITIONS: PromoDefinition[] = [];

export type PromoRejection =
  | "unknown" // no code matches
  | "not_configured" // code exists but its offer-id env var is unset
  | "wrong_cycle"; // code isn't valid for the selected billing cycle

export interface ResolvedPromo {
  code: string;
  label: string;
  offerId: string;
  discount: PromoDiscount;
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
  return {
    ok: true,
    promo: {
      code: def.code,
      label: def.label,
      offerId,
      discount: def.discount,
    },
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
