/**
 * POST /api/razorpay/subscription
 *
 * Creates a Razorpay subscription from a (planId × billingCycle) pair.
 * Returns the subscription id + public key so the client can open
 * Razorpay Checkout.
 *
 * The client never touches RAZORPAY_KEY_SECRET — it stays in this route.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSubscription } from "@/lib/razorpay/client";
import { getRazorpayPublicKeyId } from "@/lib/razorpay/config";
import {
  resolvePromoCode,
  resolveAutoPromo,
  promoRejectionMessage,
} from "@/lib/razorpay/promos";
import type {
  CreateSubscriptionResponse,
  ErrorResponse,
} from "@/lib/razorpay/types";

const BodySchema = z.object({
  planId: z.string().min(1),
  billingCycle: z.enum(["monthly", "annual"]),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  // Optional — empty/whitespace is treated as "no code".
  promoCode: z.string().max(64).optional(),
});

export async function POST(
  request: Request,
): Promise<NextResponse<CreateSubscriptionResponse | ErrorResponse>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid payload" },
      { status: 422 },
    );
  }

  const publicKey = getRazorpayPublicKeyId();
  if (!publicKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "NEXT_PUBLIC_RAZORPAY_KEY_ID is not configured. See .env.example.",
      },
      { status: 500 },
    );
  }

  // Resolve the promo (if any) before touching Razorpay, so an invalid code
  // fails fast with a friendly 422 and never creates a subscription. With no
  // typed code, fall back to any auto-applying offer for this cycle.
  const { promoCode, ...subscriptionInput } = parsed.data;
  const rawCode = promoCode?.trim();
  let promo;
  if (rawCode) {
    const result = resolvePromoCode(rawCode, subscriptionInput.billingCycle);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: promoRejectionMessage(result.reason) },
        { status: 422 },
      );
    }
    promo = result.promo;
  } else {
    promo = resolveAutoPromo(subscriptionInput.billingCycle);
  }

  try {
    const subscription = await createSubscription({ ...subscriptionInput, promo });
    return NextResponse.json({
      subscriptionId: subscription.id,
      keyId: publicKey,
      amountPaise: subscription.amountPaise,
      currency: subscription.currency,
      appliedPromo: subscription.appliedPromo,
    });
  } catch (err) {
    // Razorpay's Node SDK throws plain objects, not Error instances, so we
    // unwrap their { statusCode, error: { code, description, … } } shape
    // before logging — otherwise the message degrades to the fallback string.
    // eslint-disable-next-line no-console
    console.error("[razorpay] subscription create failed:", err);
    const message = extractErrorMessage(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as {
      error?: { code?: string; description?: string };
      message?: string;
    };
    if (e.error?.description) {
      return `${e.error.code ?? "RAZORPAY_ERROR"}: ${e.error.description}`;
    }
    if (typeof e.message === "string" && e.message.length > 0) return e.message;
  }
  return "Failed to create subscription";
}
