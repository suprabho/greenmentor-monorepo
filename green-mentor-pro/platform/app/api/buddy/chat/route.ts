import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { resolveBuddyModel, ESG_BUDDY_SYSTEM, tools, classifyUserMessage, REFUSAL_TEXT } from "@gm/agents";
import { refusalTurn, refusalStreamResponse, latestUserText } from "@/lib/chat/guard-response";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * ESG Buddy streaming chat — the platform per-user surface. Reuses the SAME
 * gateway, system prompt, and generative-UI tools as the esg-agents pipeline
 * (now shared via @gm/agents). The model resolves at request time: the Vercel AI
 * Gateway when AI_GATEWAY_API_KEY/OIDC is set, else a direct Anthropic fallback
 * via ANTHROPIC_API_KEY (the same key the pipeline agents use).
 */
export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

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
