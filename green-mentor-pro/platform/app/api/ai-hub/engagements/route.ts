import { NextResponse } from "next/server";
import { createEngagement, listEngagements } from "@gm/orchestrator";
import { getEngagementContext } from "@/lib/engagement-session";

export const runtime = "nodejs";

// GET /api/ai-hub/engagements — list the signed-in user's BRSR engagements.
export async function GET() {
  const ctx = await getEngagementContext();
  if (!ctx) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const engagements = await listEngagements(ctx.orgId);
  return NextResponse.json({ engagements });
}

// POST /api/ai-hub/engagements — create a BRSR engagement (seeds the 8 phases).
export async function POST(req: Request) {
  const ctx = await getEngagementContext();
  if (!ctx) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const body = (await req.json()) as {
    clientName?: string;
    financialYear?: string;
    framework?: string[];
    config?: Record<string, unknown>;
  };
  if (!body.clientName || !body.financialYear) {
    return NextResponse.json({ error: "clientName and financialYear are required" }, { status: 400 });
  }

  try {
    const engagement = await createEngagement(ctx.orgId, {
      clientName: body.clientName,
      financialYear: body.financialYear,
      framework: body.framework ?? ["BRSR"],
      config: body.config ?? {},
      createdBy: ctx.userId,
    });
    return NextResponse.json({ engagement }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
