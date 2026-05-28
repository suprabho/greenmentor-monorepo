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
import type {
  CreateSubscriptionResponse,
  ErrorResponse,
} from "@/lib/razorpay/types";

const BodySchema = z.object({
  planId: z.string().min(1),
  billingCycle: z.enum(["monthly", "annual"]),
  name: z.string().min(2).max(120),
  email: z.string().email(),
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

  try {
    const subscription = await createSubscription(parsed.data);
    return NextResponse.json({
      subscriptionId: subscription.id,
      keyId: publicKey,
      amountPaise: subscription.amountPaise,
      currency: subscription.currency,
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
