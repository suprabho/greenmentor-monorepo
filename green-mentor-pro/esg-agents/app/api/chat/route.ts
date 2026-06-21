import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { resolveBuddyModel, ESG_BUDDY_SYSTEM } from "@/lib/ai/gateway";
import { tools } from "@/lib/ai/tools";

export const maxDuration = 30;

/**
 * ESG Buddy streaming chat. The model is resolved at request time: the Vercel AI
 * Gateway when AI_GATEWAY_API_KEY/OIDC is available, otherwise a direct Anthropic
 * fallback via ANTHROPIC_API_KEY (the same key the pipeline agents use).
 * Generative-UI tools (lib/ai/tools.ts) stream structured input/output that the
 * client renders as components; stepCountIs lets Buddy add a sentence after a tool.
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
    // Surface real errors (e.g. no working model credential) to the client UI
    // instead of the default masked "An error occurred". The hint names the path
    // that was tried and is environment-aware (Vercel env vars vs local .env.local).
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (/api[_ ]?key|gateway|unauthor|forbidden|401|403/i.test(msg)) {
        const where = process.env.VERCEL
          ? "your Vercel project (Settings → Environment Variables), then redeploy"
          : "green-mentor-pro/esg-agents/.env.local, then restart the dev server";
        return `ESG Buddy has no working model credential (tried: ${via}). Set AI_GATEWAY_API_KEY (Vercel AI Gateway) or ANTHROPIC_API_KEY (direct Claude fallback) in ${where}.`;
      }
      return msg;
    },
  });
}
