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
}

/** POST /api/razorpay/subscription — success response. */
export interface CreateSubscriptionResponse {
  subscriptionId: string;
  keyId: string;
  amountPaise: number;
  currency: string;
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
