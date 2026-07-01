import { NextResponse } from "next/server";
import { getEngagementContext } from "@/lib/engagement-session";
import { createConversation, listConversations } from "@/lib/chat/repo";
import { jsonError } from "@/lib/api-error";

export const runtime = "nodejs";

// GET /api/ai-hub/chat/conversations — the signed-in user's chat history.
export async function GET() {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    const conversations = await listConversations(ctx.orgId, ctx.userId);
    return NextResponse.json({ conversations });
  } catch (e) {
    return jsonError(e);
  }
}

// POST /api/ai-hub/chat/conversations — start a new (empty) conversation.
export async function POST() {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    const { id } = await createConversation(ctx.orgId, ctx.userId);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
