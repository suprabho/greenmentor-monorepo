import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib";
import { ESG_BUDDY_SYSTEM } from "@gm/agents";

/**
 * Rules appended to a chat system prompt so the model answers with **OpenUI Lang**
 * (rendered by <Renderer> in MessageList) instead of markdown/prose. `library.prompt()`
 * prepends the OpenUI Lang syntax + the catalog of allowed components ahead of these rules,
 * so the model knows exactly which components it may emit.
 */
const GENUI_RULES = [
  "Respond by composing generative-UI components from the library — never plain markdown or raw prose paragraphs.",
  "Never emit markdown syntax (no '#' headings, '**bold**', or '| … |' tables). Use the library's heading, text, card, table, list, and callout components instead.",
  "Use a table to compare frameworks/standards, cards to group related facts, and a callout to flag mandatory-vs-voluntary requirements or cautions.",
  "End an answer with 1–3 relevant follow-up questions as actionable items the user can click to continue the conversation.",
  "Keep tool behavior unchanged: when the user wants to draft a data request, still call the draftDataRequest tool.",
];

/**
 * Wrap any base system prompt so the model emits OpenUI Lang. Used for both the ESG Buddy
 * chat (static prompt) and the engagement Report Copilot (prompt rebuilt per request).
 *
 * Safe to import server-side: the `/genui-lib` subpath is the same definition set OpenUI's
 * own Node CLI consumes — no browser-only code runs at import time.
 */
export function withGenerativeUi(basePrompt: string): string {
  return openuiChatLibrary.prompt({ preamble: basePrompt, additionalRules: GENUI_RULES });
}

/** ESG Buddy's OpenUI-Lang system prompt — static preamble, so computed once at module load. */
export const ESG_BUDDY_GENUI_SYSTEM = withGenerativeUi(ESG_BUDDY_SYSTEM);
