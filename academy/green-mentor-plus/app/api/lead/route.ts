import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Lead sink. Upserts the onboarding lead (keyed by leadId) into a Google
 * Sheet via an Apps Script web app — see docs/lead-sheet-setup.md. The
 * webhook URL stays server-side; the browser only ever talks to this route.
 * Falls back to console logging when SHEETS_WEBHOOK_URL is unset (local dev).
 */

const LeadSchema = z.object({
  leadId: z.string().min(1).optional(),
  status: z.enum(["in_progress", "completed"]).optional(),
  step: z.string().optional(),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  segment: z
    .enum(["student", "mid-career", "business-leader"])
    .nullable()
    .optional(),
  planId: z.string().nullable().optional(),
  goals: z.array(z.string()).default([]),
  billingCycle: z.enum(["monthly", "annual"]).optional(),
  razorpaySubscriptionId: z.string().nullable().optional(),
  razorpayPaymentId: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const parsed = LeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid payload", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const lead = {
    ...parsed.data,
    // Tolerate callers that omit these (e.g. a stray direct POST) — the sheet
    // still needs a key and a status to upsert against.
    leadId: parsed.data.leadId ?? crypto.randomUUID(),
    status: parsed.data.status ?? "in_progress",
    receivedAt: new Date().toISOString(),
  };

  const webhookUrl = process.env.SHEETS_WEBHOOK_URL;
  if (!webhookUrl) {
    // Dev fallback: no sheet configured, log instead.
    // eslint-disable-next-line no-console
    console.log("[lead]", JSON.stringify(lead));
    return NextResponse.json({ ok: true, id: lead.leadId });
  }

  const secret = process.env.SHEETS_WEBHOOK_SECRET;
  try {
    // Apps Script web apps 302 to a googleusercontent URL; fetch follows the
    // redirect by default and returns the doPost result. The secret travels in
    // the body — Apps Script doesn't expose request headers to doPost.
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(secret ? { secret, lead } : { lead }),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error("[lead] sheet webhook failed", res.status);
      return NextResponse.json(
        { ok: false, error: "Sheet write failed" },
        { status: 502 },
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[lead] sheet webhook error", err);
    return NextResponse.json(
      { ok: false, error: "Sheet write error" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, id: lead.leadId });
}

export async function GET() {
  // Method discovery aid — return 405 on GET.
  return NextResponse.json(
    { ok: false, error: "Use POST" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
