import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { BUDDY_MODEL, ESG_BUDDY_SYSTEM } from "@/lib/ai/gateway";
import { tools } from "@/lib/ai/tools";

export const maxDuration = 30;

/**
 * ESG Buddy streaming chat. `BUDDY_MODEL` is a plain "anthropic/claude-..." string
 * that the AI SDK routes through the Vercel AI Gateway (AI_GATEWAY_API_KEY).
 * Generative-UI tools (lib/ai/tools.ts) stream structured input/output that the
 * client renders as components; stepCountIs lets Buddy add a sentence after a tool.
 */
export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: BUDDY_MODEL,
    system: ESG_BUDDY_SYSTEM,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse({
    // Surface real errors (e.g. a missing AI_GATEWAY_API_KEY) to the client UI
    // instead of the default masked "An error occurred".
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (/api[_ ]?key|gateway|unauthor/i.test(msg)) {
        return "ESG Buddy can't reach the AI Gateway — set AI_GATEWAY_API_KEY in green-mentor-pro/esg-agents/.env.local and restart.";
      }
      return msg;
    },
  });
}
