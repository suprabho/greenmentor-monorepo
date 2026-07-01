import { z } from "zod";

/**
 * Request-body validation for the AI Hub chat POST routes (standalone Chat and the
 * engagement copilot — both driven by DefaultChatTransport, which POSTs
 * `{ id, messages, trigger, messageId }`). We only assert the envelope so a
 * malformed body fails as a clean 400 instead of throwing deep inside
 * `convertToModelMessages`.
 *
 * Parts are validated permissively on purpose: v6 UIMessage parts are a wide union
 * (text / file / tool-* / reasoning / step-start ...). Do NOT tighten this to a
 * v5-era text-only schema — that would reject legitimate file/tool/reasoning parts.
 */
const uiPart = z.object({ type: z.string() }).passthrough();

const uiMessage = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(uiPart).min(1),
});

export const chatPostBodySchema = z.object({
  id: z.string().optional(),
  messages: z.array(uiMessage).min(1),
  trigger: z.string().optional(),
  messageId: z.string().optional(),
});

export type ChatPostBody = z.infer<typeof chatPostBodySchema>;
