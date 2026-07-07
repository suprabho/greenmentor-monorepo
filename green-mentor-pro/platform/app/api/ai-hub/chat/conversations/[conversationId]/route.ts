import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { resolveBuddyModel, tools, classifyUserMessage, refusalGenuiCard } from "@gm/agents";
import { buildSkillTools } from "@gm/orchestrator";
import { ESG_BUDDY_GENUI_SYSTEM } from "@/lib/chat/genui-system";
import { refusalTurn, refusalStreamResponse, latestUserText } from "@/lib/chat/guard-response";
import { ensureOrchestratorInit } from "@/lib/orchestrator-server";
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
// A skill tool (runScopingSkill / extractBillSkill / understandEpdSkill) runs a full
// agent inside the stream — a multi-turn Anthropic loop that can take well over a
// minute for the deeper (Opus) extraction skill. Give the whole turn ample headroom;
// plain conversational turns still finish in seconds.
export const maxDuration = 300;

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

    // Pre-flight domain guard: classify the latest user message and short-circuit
    // with a canned refusal BEFORE the model or any skill tools run. Off-domain,
    // code-generation, and jailbreak/prompt-extraction attempts never reach the model.
    const verdict = await classifyUserMessage(latestUserText(messages));
    if (!verdict.allow) {
      const turn = refusalTurn(refusalGenuiCard(verdict.category));
      try {
        await replaceMessages(ctx.orgId, conversationId, [
          ...messages.map((m) => ({ id: m.id, role: m.role, parts: m.parts as unknown[] })),
          turn,
        ]);
        await touchConversation(ctx.orgId, conversationId);
      } catch (err) {
        console.error(`[ai-hub/chat] failed to persist refusal for ${conversationId}:`, err);
      }
      return refusalStreamResponse(turn);
    }

    const { model } = resolveBuddyModel();
    // Only the first exchange needs a generated title — setTitleIfEmpty never
    // clobbers a later rename, so skip the extra model call on later turns.
    const isFirstTurn = !messages.some((m) => m.role === "assistant");

    // Point the agent runtime at @gm/orchestrator's agents/ dir so the skill tools can
    // loadAgent() when the model calls one mid-stream.
    ensureOrchestratorInit();

    const result = streamText({
      model,
      system: ESG_BUDDY_GENUI_SYSTEM,
      messages: await convertToModelMessages(messages),
      // The buddy's generative-UI tools + the standalone one-shot skills (each runs a
      // packaged agent and returns a structured card).
      tools: { ...tools, ...buildSkillTools({ orgId: ctx.orgId }) },
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
        // Log the real reason server-side; never leak the model provider / env-var
        // setup to the end user.
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[ai-hub/chat] stream error for ${conversationId}:`, msg);
        return "ESG Buddy is temporarily unavailable. Please try again in a moment.";
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
