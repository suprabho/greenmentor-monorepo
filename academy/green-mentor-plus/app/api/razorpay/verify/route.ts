/**
 * POST /api/razorpay/verify
 *
 * Verifies the HMAC signature returned by Razorpay Checkout. Treat the
 * client-supplied payment_id + subscription_id as untrusted until this
 * passes.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPaymentSignature } from "@/lib/razorpay/client";
import type {
  ErrorResponse,
  VerifyPaymentResponse,
} from "@/lib/razorpay/types";

const BodySchema = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_subscription_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(
  request: Request,
): Promise<NextResponse<VerifyPaymentResponse | ErrorResponse>> {
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

  const valid = verifyPaymentSignature(parsed.data);
  if (!valid) {
    // eslint-disable-next-line no-console
    console.warn(
      "[razorpay] signature mismatch for",
      parsed.data.razorpay_subscription_id,
    );
    return NextResponse.json(
      { ok: false, error: "Signature verification failed" },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true });
}
