import { NextResponse } from "next/server";
import { getEngagementSnapshot } from "@gm/orchestrator";
import { getEngagementContext } from "@/lib/engagement-session";

export const runtime = "nodejs";

// GET /api/ai-hub/engagements/[id] — the board snapshot (engagement + phases + latest artifact per phase).
export async function GET(_req: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  const ctx = await getEngagementContext();
  if (!ctx) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const { engagementId } = await params;

  const snapshot = await getEngagementSnapshot(ctx.orgId, engagementId);
  if (!snapshot) return NextResponse.json({ error: "engagement not found" }, { status: 404 });
  return NextResponse.json({ snapshot });
}
