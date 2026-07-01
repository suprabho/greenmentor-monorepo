import { NextResponse } from "next/server";
import { getEngagementContext } from "@/lib/engagement-session";
import { createConversation, listConversations } from "@/lib/chat/repo";

export const runtime = "nodejs";

// GET /api/ai-hub/chat/conversations — the signed-in user's chat history.
export async function GET() {
  const ctx = await getEngagementContext();
  if (!ctx) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const conversations = await listConversations(ctx.orgId, ctx.userId);
  return NextResponse.json({ conversations });
}

// POST /api/ai-hub/chat/conversations — start a new (empty) conversation.
export async function POST() {
  const ctx = await getEngagementContext();
  if (!ctx) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const { id } = await createConversation(ctx.orgId, ctx.userId);
  return NextResponse.json({ id }, { status: 201 });
}
