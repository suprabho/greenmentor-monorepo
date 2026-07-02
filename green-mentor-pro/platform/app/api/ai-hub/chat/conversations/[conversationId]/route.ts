import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { resolveBuddyModel, tools } from "@gm/agents";
import { ESG_BUDDY_GENUI_SYSTEM } from "@/lib/chat/genui-system";
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
import { ChatError, toChatError } from "@/lib/chat/errors";
import { chatPostBodySchema } from "@/lib/chat/schema";

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
//
// The whole pre-stream body is wrapped: getEngagementContext (→ createAdminClient,
// which throws when SUPABASE_SERVICE_ROLE_KEY is missing) and body parsing must
// return JSON, never an HTML error page — the client parses `res.json()`/the stream
// and would otherwise die on "Unexpected token '<'".
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return new ChatError("unauthorized").toResponse();
    const { conversationId } = await params;
    if (!(await assertOwner(ctx.orgId, ctx.userId, conversationId))) {
      return new ChatError("not_found").toResponse();
    }

    const parsed = chatPostBodySchema.safeParse(await req.json());
    if (!parsed.success) return new ChatError("bad_request").toResponse();
    const messages = parsed.data.messages as unknown as UIMessage[];

    const { model } = resolveBuddyModel();
    // Only the first exchange needs a generated title — setTitleIfEmpty never
    // clobbers a later rename, so skip the extra model call on later turns.
    const isFirstTurn = !messages.some((m) => m.role === "assistant");

    const result = streamText({
      model,
      system: ESG_BUDDY_GENUI_SYSTEM,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(6),
    });

    // Drive the stream to completion server-side so onFinish still persists the
    // transcript if the client disconnects mid-stream (per the AI SDK message-
    // persistence guide's client-disconnect handling).
    //
    // DO NOT "fix" this as a double-consume: verified against ai@6 dist
    // (StreamTextResult.teeStream, index.mjs:8146) that consumeStream() and
    // toUIMessageStreamResponse() each read an INDEPENDENT tee of baseStream.
    // Removing this line reintroduces the message-loss-on-disconnect bug (#59).
    void result.consumeStream();

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      // Persist the full transcript before the response closes. This MUST be
      // awaited: a detached promise here is dropped when the serverless function
      // suspends on response close — that's why chats weren't being saved.
      onFinish: async ({ messages: finalMessages }) => {
        const stored = finalMessages.map((m) => ({ id: m.id, role: m.role, parts: m.parts as unknown[] }));
        try {
          await replaceMessages(ctx.orgId, conversationId, stored);
          await touchConversation(ctx.orgId, conversationId);
          if (isFirstTurn) {
            const seed = firstUserText(stored);
            if (seed) await setTitleIfEmpty(ctx.orgId, conversationId, await generateConversationTitle(seed));
          }
        } catch (err) {
          console.error(`[ai-hub/chat] failed to persist conversation ${conversationId}:`, err);
        }
      },
      onError: (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        if (/api[_ ]?key|gateway|unauthor|forbidden|401|403/i.test(msg)) {
          return "Chat has no working model credential. Set ANTHROPIC_API_KEY (or AI_GATEWAY_API_KEY) in green-mentor-pro/platform/.env.local and restart.";
        }
        return msg;
      },
    });
  } catch (e) {
    return toChatError(e).toResponse();
  }
}

// GET — hydrate the persisted conversation on open. (The standalone Chat page now
// SSR-loads initialMessages, but this stays for any client-side re-hydration.)
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return new ChatError("unauthorized").toResponse();
    const { conversationId } = await params;
    if (!(await assertOwner(ctx.orgId, ctx.userId, conversationId))) {
      return new ChatError("not_found").toResponse();
    }
    const messages = await loadMessages(ctx.orgId, conversationId);
    return Response.json({ messages });
  } catch (e) {
    return toChatError(e).toResponse();
  }
}

// PATCH — rename.
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return new ChatError("unauthorized").toResponse();
    const { conversationId } = await params;
    if (!(await assertOwner(ctx.orgId, ctx.userId, conversationId))) {
      return new ChatError("not_found").toResponse();
    }
    const { title } = (await req.json()) as { title?: string };
    if (!title?.trim()) return new ChatError("bad_request", "A title is required.").toResponse();
    await renameConversation(ctx.orgId, ctx.userId, conversationId, title.trim());
    return Response.json({ ok: true });
  } catch (e) {
    return toChatError(e).toResponse();
  }
}

// DELETE — remove the conversation (messages cascade).
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return new ChatError("unauthorized").toResponse();
    const { conversationId } = await params;
    if (!(await assertOwner(ctx.orgId, ctx.userId, conversationId))) {
      return new ChatError("not_found").toResponse();
    }
    await deleteConversation(ctx.orgId, ctx.userId, conversationId);
    return Response.json({ ok: true });
  } catch (e) {
    return toChatError(e).toResponse();
  }
}
