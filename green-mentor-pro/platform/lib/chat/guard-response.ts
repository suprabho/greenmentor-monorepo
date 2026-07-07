import { randomUUID } from "node:crypto";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

/**
 * Shared glue for the pre-flight domain guard (see @gm/agents/guard). When the
 * classifier blocks a message, a chat route builds a canned assistant turn here and
 * streams it back WITHOUT calling the model or any tools — so an off-domain,
 * code-generation, or jailbreak attempt never reaches the powerful model.
 */

export interface RefusalTurn {
  id: string;
  role: "assistant";
  parts: { type: "text"; text: string }[];
}

/** Build the synthetic assistant turn carrying the guard's refusal body. */
export function refusalTurn(body: string): RefusalTurn {
  return { id: randomUUID(), role: "assistant", parts: [{ type: "text", text: body }] };
}

/**
 * Stream a canned assistant turn to the client using the same UIMessage stream
 * shape `useChat` consumes, so the refusal renders exactly like a normal reply
 * (OpenUI Lang on the generative-UI surfaces, plain text on /api/buddy/chat).
 */
export function refusalStreamResponse(turn: RefusalTurn): Response {
  const text = turn.parts.map((p) => p.text).join("");
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "start", messageId: turn.id });
      writer.write({ type: "text-start", id: "0" });
      writer.write({ type: "text-delta", id: "0", delta: text });
      writer.write({ type: "text-end", id: "0" });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

/** The text of the most recent user message — what the guard classifies. */
export function latestUserText(messages: { role: string; parts: unknown[] }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "user") continue;
    return (messages[i].parts as { type: string; text?: string }[])
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text)
      .join(" ")
      .trim();
  }
  return "";
}
