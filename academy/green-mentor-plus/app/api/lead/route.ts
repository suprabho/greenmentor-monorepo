import { NextResponse } from "next/server";
import { z } from "zod";
import { sheetsConfigured, upsertLead } from "@/lib/lead/sheets";

/**
 * Lead sink. Upserts the onboarding lead (keyed by leadId) directly into a
 * Google Sheet via the Sheets API, authenticating as a service account — no
 * Apps Script web app, no /exec URL. See docs/lead-sheet-setup.md. Credentials
 * stay server-side; the browser only ever talks to this route. Falls back to
 * console logging when the service-account env vars are unset (local dev).
 */

const LeadSchema = z.object({
  leadId: z.string().min(1).optional(),
  status: z.enum(["in_progress", "completed"]).optional(),
  step: z.string().optional(),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(32).optional(),
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

  if (!sheetsConfigured()) {
    // Dev fallback: no service account configured, log instead.
    // eslint-disable-next-line no-console
    console.log("[lead]", JSON.stringify(lead));
    return NextResponse.json({ ok: true, id: lead.leadId });
  }

  try {
    await upsertLead(lead);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[lead] sheet write error", err);
    return NextResponse.json(
      { ok: false, error: "Sheet write failed" },
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
