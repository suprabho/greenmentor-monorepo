/**
 * Env-driven launch offers — the server-side half of the flat discount.
 *
 * `flatDiscount` (lib/data/plans.ts, from NEXT_PUBLIC_FLAT_DISCOUNT_INR) owns
 * the customer-facing amount; this module maps a billing cycle to the Razorpay
 * `offer_…` id that applies the same discount to the actual charge. Offers are
 * created in Dashboard → Offers and are plan-specific, so each cycle needs its
 * own id. Ids differ between test and live accounts, hence env vars:
 *
 *   RAZORPAY_OFFER_MONTHLY — offer on the monthly plan
 *   RAZORPAY_OFFER_ANNUAL  — offer on the annual plan
 *
 * ⚠️  Keep each dashboard offer's amount equal to NEXT_PUBLIC_FLAT_DISCOUNT_INR.
 *     The offer is what Razorpay actually charges; the env amount only drives
 *     the price we render — if they drift, the preview won't match the charge.
 *
 * An unset env var (or a 0 discount) means no offer for that cycle → full
 * price, so shipping with the vars missing is safe.
 */

import { flatDiscount } from "@/lib/data/plans";
import type { BillingCycle } from "@/lib/store/onboarding";

const OFFER_ENV_BY_CYCLE: Record<BillingCycle, string> = {
  monthly: "RAZORPAY_OFFER_MONTHLY",
  annual: "RAZORPAY_OFFER_ANNUAL",
};

export interface ResolvedOffer {
  /** Razorpay `offer_…` id attached to the subscription. */
  offerId: string;
  /** Flat discount in paise — mirrors NEXT_PUBLIC_FLAT_DISCOUNT_INR; used to
   *  compute the displayed (discounted) first charge. */
  discountPaise: number;
  /** Discount applies to the first billing cycle only (full price after). */
  firstCycleOnly: boolean;
}

/**
 * Offer for a billing cycle, or undefined when the discount is switched off
 * (NEXT_PUBLIC_FLAT_DISCOUNT_INR unset/0) or the cycle's offer id isn't set.
 */
export function resolveOfferForCycle(
  cycle: BillingCycle,
): ResolvedOffer | undefined {
  if (flatDiscount.discountInr <= 0) return undefined;
  const offerId = process.env[OFFER_ENV_BY_CYCLE[cycle]];
  if (!offerId) return undefined;
  return {
    offerId,
    discountPaise: flatDiscount.discountInr * 100,
    firstCycleOnly: flatDiscount.firstCycleOnly,
  };
}
