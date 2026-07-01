import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { resolveBuddyModel, ESG_BUDDY_SYSTEM, tools } from "@gm/agents";
import { getEngagementContext } from "@/lib/engagement-session";
import {
  assertOwner,
  loadMessages,
  replaceMessages,
  touchConversation,
  setTitleIfEmpty,
  renameConversation,
  deleteConversation,
} from "@/lib/chat/repo";
import { generateConversationTitle } from "@/lib/chat/title";

export const runtime = "nodejs";
export const maxDuration = 60; // uploads + tools; longer than the 30s stateless buddy

type Params = { params: Promise<{ conversationId: string }> };

function firstUserText(messages: { role: string; parts: unknown[] }[]): string {
  const u = messages.find((m) => m.role === "user");
  if (!u) return "";
  return (u.parts as { type: string; text?: string }[])
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text)
    .join(" ")
    .trim();
}

// POST — stream a reply (same gateway/system/tools as ESG Buddy) and persist the
// full transcript on finish. Mirrors the engagement chat route's onFinish pattern.
export async function POST(req: Request, { params }: Params) {
  const ctx = await getEngagementContext();
  if (!ctx) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const { conversationId } = await params;
  if (!(await assertOwner(ctx.orgId, ctx.userId, conversationId))) {
    return new Response(JSON.stringify({ error: "Conversation not found" }), { status: 404 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();
  const { model } = resolveBuddyModel();

  const result = streamText({
    model,
    system: ESG_BUDDY_SYSTEM,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(6),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: ({ messages: finalMessages }) => {
      const stored = finalMessages.map((m) => ({ id: m.id, role: m.role, parts: m.parts as unknown[] }));
      void (async () => {
        await replaceMessages(ctx.orgId, conversationId, stored);
        await touchConversation(ctx.orgId, conversationId);
        const seed = firstUserText(stored);
        if (seed) {
          const title = await generateConversationTitle(seed);
          await setTitleIfEmpty(ctx.orgId, conversationId, title);
        }
      })().catch(() => {});
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (/api[_ ]?key|gateway|unauthor|forbidden|401|403/i.test(msg)) {
        return "Chat has no working model credential. Set ANTHROPIC_API_KEY (or AI_GATEWAY_API_KEY) in green-mentor-pro/platform/.env.local and restart.";
      }
      return msg;
    },
  });
}

// GET — hydrate the persisted conversation on open.
export async function GET(_req: Request, { params }: Params) {
  const ctx = await getEngagementContext();
  if (!ctx) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const { conversationId } = await params;
  if (!(await assertOwner(ctx.orgId, ctx.userId, conversationId))) {
    return new Response(JSON.stringify({ error: "Conversation not found" }), { status: 404 });
  }
  const messages = await loadMessages(ctx.orgId, conversationId);
  return Response.json({ messages });
}

// PATCH — rename.
export async function PATCH(req: Request, { params }: Params) {
  const ctx = await getEngagementContext();
  if (!ctx) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const { conversationId } = await params;
  if (!(await assertOwner(ctx.orgId, ctx.userId, conversationId))) {
    return new Response(JSON.stringify({ error: "Conversation not found" }), { status: 404 });
  }
  const { title } = (await req.json()) as { title?: string };
  if (!title?.trim()) return new Response(JSON.stringify({ error: "title required" }), { status: 400 });
  await renameConversation(ctx.orgId, ctx.userId, conversationId, title.trim());
  return Response.json({ ok: true });
}

// DELETE — remove the conversation (messages cascade).
export async function DELETE(_req: Request, { params }: Params) {
  const ctx = await getEngagementContext();
  if (!ctx) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const { conversationId } = await params;
  if (!(await assertOwner(ctx.orgId, ctx.userId, conversationId))) {
    return new Response(JSON.stringify({ error: "Conversation not found" }), { status: 404 });
  }
  await deleteConversation(ctx.orgId, ctx.userId, conversationId);
  return Response.json({ ok: true });
}
