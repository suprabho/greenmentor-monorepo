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
      // "Do NOT answer it" matters: a first message like "Extract the ESG data from
      // this document." (the document itself being an attachment the titler can't
      // see) otherwise gets *replied to* — the rail ends up titled
      // "Please share the document you'd like me to extract".
      system:
        "You label chat threads. Given the user's first message, return ONLY a 3-6 word title for the thread — no quotes, no trailing punctuation. Do NOT answer, respond to, or ask anything about the message; describe what the thread is about. If the message refers to a document you cannot see, title it by the task (e.g. \"Bill data extraction\").",
      prompt: `First user message:\n${firstUserText.slice(0, 500)}\n\nTitle:`,
    });
    const cleaned = text.trim().replace(/^["']|["']$/g, "").replace(/\.$/, "").trim();
    return cleaned.slice(0, 60) || fallback;
  } catch {
    return fallback;
  }
}
