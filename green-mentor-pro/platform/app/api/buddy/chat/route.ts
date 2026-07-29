import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { resolveBuddyModel, ESG_BUDDY_SYSTEM, tools, classifyUserMessage, REFUSAL_TEXT } from "@gm/agents";
import { refusalTurn, refusalStreamResponse, latestUserText } from "@/lib/chat/guard-response";
import { ChatError } from "@/lib/chat/errors";
import { createClient } from "@/lib/supabase/server";
import { checkAiAllowance, insufficientCreditsMessage, recordAiUsage } from "@/lib/ai/usage";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Resolve the signed-in user, or null. Deliberately lighter than
 * getEngagementContext(): /buddy is NOT in the middleware's PROTECTED_PATHS, so
 * this route serves signed-out visitors too, and it must not depend on the
 * service-role key or provision an org just to answer a public question.
 *
 * Consequence: signed-out ESG Buddy usage is unmetered. That's the existing shape
 * of this surface, not something metering changes — capping it is a session/IP
 * throttle question, not a credits one.
 */
async function optionalUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch (err) {
    console.error("[buddy/chat] could not resolve session; treating as anonymous:", err);
    return null;
  }
}

/**
 * ESG Buddy streaming chat — the platform per-user surface. Reuses the SAME
 * gateway, system prompt, and generative-UI tools as the esg-agents pipeline
 * (now shared via @gm/agents). The model resolves at request time: the Vercel AI
 * Gateway when AI_GATEWAY_API_KEY/OIDC is set, else a direct Anthropic fallback
 * via ANTHROPIC_API_KEY (the same key the pipeline agents use).
 */
export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Credits gate for signed-in users: free daily allowance, then a balance floor.
  // Before the domain guard so a refused turn costs the user nothing — the guard
  // itself makes a small (house-paid) model call.
  const userId = await optionalUserId();
  const allowance = userId ? await checkAiAllowance(userId, "buddy_chat") : null;
  if (allowance && !allowance.allowed) {
    return new ChatError("insufficient_credits", insufficientCreditsMessage("buddy_chat")).toResponse();
  }

  // Pre-flight domain guard: refuse off-domain / code / jailbreak before the model
  // runs. Plain-text refusal — this surface renders markdown, not OpenUI Lang.
  const verdict = await classifyUserMessage(latestUserText(messages));
  if (!verdict.allow) return refusalStreamResponse(refusalTurn(REFUSAL_TEXT));

  const { model } = resolveBuddyModel();

  const result = streamText({
    model,
    system: ESG_BUDDY_SYSTEM,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
    // Metering hook — `totalUsage` sums every step of the tool loop. Anonymous
    // turns record nothing (no user to attribute them to).
    onFinish: ({ totalUsage, response, model: stepModel }) => {
      if (!userId || !allowance) return;
      return recordAiUsage({
        userId,
        surface: "buddy_chat",
        model: response.modelId || stepModel.modelId,
        usage: totalUsage,
        freeTier: allowance.freeTier,
      });
    },
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      // Log the real reason server-side; never leak the model provider / env-var
      // setup to the end user.
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[buddy/chat] stream error:", msg);
      return "ESG Buddy is temporarily unavailable. Please try again in a moment.";
    },
  });
}
