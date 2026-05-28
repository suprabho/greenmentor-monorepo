/**
 * Razorpay server client — single seam between our API routes and the
 * razorpay npm SDK. Keeps imports of the SDK + node:crypto in one place so
 * the rest of the codebase stays edge-compatible.
 *
 * NEVER import this from a "use client" file — it reads
 * RAZORPAY_KEY_SECRET.
 */

import "server-only";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import {
  getRazorpayServerKeys,
  getRazorpayWebhookSecret,
  getRazorpayPlanId,
  getTotalCountForCycle,
} from "./config";
import type { BillingCycle } from "@/lib/store/onboarding";

let cached: Razorpay | null = null;

function getInstance(): Razorpay {
  if (cached) return cached;
  const { keyId, keySecret } = getRazorpayServerKeys();
  cached = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return cached;
}

export interface CreateSubscriptionInput {
  planId: string;
  billingCycle: BillingCycle;
  name: string;
  email: string;
}

export interface CreatedSubscription {
  id: string;
  status: string;
  plan_id: string;
  /** Razorpay returns amount on the plan, not the subscription itself; we
   *  fetch it via the plan lookup so the client can render a confirmed price. */
  amountPaise: number;
  currency: string;
}

/**
 * Create a Razorpay subscription. The `notes` block carries our internal lead
 * fields so we can join Razorpay events back to the user in webhooks.
 */
export async function createSubscription(
  input: CreateSubscriptionInput,
): Promise<CreatedSubscription> {
  const rzp = getInstance();
  const planId = getRazorpayPlanId(input.planId, input.billingCycle);
  const totalCount = getTotalCountForCycle(input.billingCycle);

  const subscription = await rzp.subscriptions.create({
    plan_id: planId,
    total_count: totalCount,
    quantity: 1,
    customer_notify: 1,
    notes: {
      gm_plan_id: input.planId,
      gm_billing_cycle: input.billingCycle,
      gm_name: input.name,
      gm_email: input.email,
    },
  });

  // Pull amount + currency off the plan so the client renders a number that
  // matches what Razorpay will charge — not what `lib/data/plans.ts` says.
  const plan = await rzp.plans.fetch(planId);
  const rawAmount = plan.item?.amount;
  const amountPaise =
    typeof rawAmount === "number"
      ? rawAmount
      : typeof rawAmount === "string"
        ? Number.parseInt(rawAmount, 10) || 0
        : 0;
  const currency = plan.item?.currency ?? "INR";

  return {
    id: subscription.id,
    status: String(subscription.status),
    plan_id: planId,
    amountPaise,
    currency,
  };
}

/**
 * Verify a payment signature returned by Razorpay Checkout.
 * Razorpay docs: signature = HMAC_SHA256(payment_id + "|" + subscription_id, key_secret).
 */
export function verifyPaymentSignature(input: {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}): boolean {
  const { keySecret } = getRazorpayServerKeys();
  const payload = `${input.razorpay_payment_id}|${input.razorpay_subscription_id}`;
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(payload)
    .digest("hex");
  return timingSafeEqualHex(expected, input.razorpay_signature);
}

/**
 * Verify a webhook payload using the dashboard-set webhook secret.
 * Different secret from the key_secret above.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false;
  const secret = getRazorpayWebhookSecret();
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return timingSafeEqualHex(expected, signatureHeader);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
