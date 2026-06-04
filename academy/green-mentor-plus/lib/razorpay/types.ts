/**
 * Shared Razorpay types — both server (API routes) and client (checkout page)
 * import from here so the wire shape can't drift.
 */

import type { BillingCycle } from "@/lib/store/onboarding";

/** POST /api/razorpay/subscription — request body. */
export interface CreateSubscriptionRequest {
  planId: string;
  billingCycle: BillingCycle;
  name: string;
  email: string;
  /** Optional promo code; server resolves it to a Razorpay offer (or rejects). */
  promoCode?: string;
}

/** A successfully applied promo — drives the "code applied" UI + struck-through
 *  original price. `amountPaise` on the response already reflects the discount. */
export interface AppliedPromo {
  code: string;
  label: string;
  originalAmountPaise: number;
  discountedAmountPaise: number;
  /** Auto-applied launch offer (non-removable in the UI) vs a typed code. */
  auto: boolean;
  /** Discount covers only the first billing cycle (full price thereafter). */
  firstCycleOnly: boolean;
}

/** POST /api/razorpay/subscription — success response. */
export interface CreateSubscriptionResponse {
  subscriptionId: string;
  keyId: string;
  /** Amount that will actually be charged — discounted when a promo applied. */
  amountPaise: number;
  currency: string;
  /** Present only when a valid promo code was applied to this subscription. */
  appliedPromo?: AppliedPromo;
}

/**
 * POST /api/razorpay/verify — request body. Field names follow Razorpay's
 * checkout `handler(response)` callback exactly, so the client can forward
 * the response verbatim.
 */
export interface VerifyPaymentRequest {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

export interface VerifyPaymentResponse {
  ok: true;
}

export interface ErrorResponse {
  ok: false;
  error: string;
}
