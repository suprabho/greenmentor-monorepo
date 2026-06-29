import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { resolveBuddyModel, ESG_BUDDY_SYSTEM, tools } from "@gm/agents";

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
  const { model, via } = resolveBuddyModel();

  const result = streamText({
    model,
    system: ESG_BUDDY_SYSTEM,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (/api[_ ]?key|gateway|unauthor|forbidden|401|403/i.test(msg)) {
        return `ESG Buddy has no working model credential (tried: ${via}). Set ANTHROPIC_API_KEY (direct Claude) or AI_GATEWAY_API_KEY in green-mentor-pro/platform/.env.local, then restart the server.`;
      }
      return msg;
    },
  });
}
