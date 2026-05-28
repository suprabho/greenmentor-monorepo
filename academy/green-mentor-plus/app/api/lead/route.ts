import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * v1: log to console; return an ID. v2 will forward to a CRM (or our SSO
 * endpoint) and create the Learnyst user before responding.
 */

const LeadSchema = z.object({
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

  const id = crypto.randomUUID();
  const lead = {
    id,
    createdAt: new Date().toISOString(),
    ...parsed.data,
  };

  // v1 sink: console. Production will swap this for a CRM / webhook call.
  // eslint-disable-next-line no-console
  console.log("[lead]", JSON.stringify(lead));

  return NextResponse.json({ ok: true, id });
}

export async function GET() {
  // Method discovery aid — return 405 on GET.
  return NextResponse.json(
    { ok: false, error: "Use POST" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
