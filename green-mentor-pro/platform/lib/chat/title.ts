import { generateText } from "ai";
import { resolveBuddyModel } from "@gm/agents";

/**
 * Generate a short conversation title from the first user message. Non-blocking
 * and failure-tolerant: any model/credential error falls back to a truncated
 * first message so titling never blocks or breaks the stream.
 */
export async function generateConversationTitle(firstUserText: string): Promise<string> {
  const fallback = firstUserText.trim().slice(0, 48) || "New chat";
  try {
    const { model } = resolveBuddyModel();
    const { text } = await generateText({
      model,
      system: "You write short, specific chat titles. Return ONLY a 3-6 word title — no quotes, no trailing punctuation.",
      prompt: `First user message:\n${firstUserText.slice(0, 500)}\n\nTitle:`,
    });
    const cleaned = text.trim().replace(/^["']|["']$/g, "").replace(/\.$/, "").trim();
    return cleaned.slice(0, 60) || fallback;
  } catch {
    return fallback;
  }
}
