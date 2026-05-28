/**
 * POST /api/razorpay/webhook
 *
 * Razorpay calls this for the full subscription lifecycle: `activated`,
 * `charged`, `pending`, `halted`, `cancelled`, `completed`, etc.
 *
 * v1: verify signature, log the event. v2 will:
 *  - persist subscription state in our DB
 *  - on `subscription.activated`, create or enrol the Learnyst user
 *  - on `subscription.cancelled` / `halted`, revoke Learnyst access
 *
 * Configure the webhook URL in the Razorpay dashboard pointed at this route
 * and set RAZORPAY_WEBHOOK_SECRET to the secret shown there.
 */

import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay/client";

export async function POST(request: Request) {
  // Razorpay signs the raw body — read as text, not JSON.
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  let valid: boolean;
  try {
    valid = verifyWebhookSignature(raw, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("[razorpay] webhook secret missing:", message);
    return NextResponse.json(
      { ok: false, error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  if (!valid) {
    // eslint-disable-next-line no-console
    console.warn("[razorpay] webhook signature mismatch");
    return NextResponse.json(
      { ok: false, error: "Invalid signature" },
      { status: 401 },
    );
  }

  let event: { event?: string; payload?: unknown };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  // eslint-disable-next-line no-console
  console.log("[razorpay] webhook", event.event ?? "(no event)");

  // TODO[Razorpay]: persist + fan out to Learnyst enrolment.
  return NextResponse.json({ ok: true });
}
