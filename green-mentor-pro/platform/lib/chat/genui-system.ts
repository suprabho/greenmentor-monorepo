import { ESG_BUDDY_SYSTEM } from "@gm/agents";
import { GENUI_SUFFIX } from "./genui-suffix";

/**
 * Append OpenUI Lang instructions to a base system prompt so the model answers with
 * generative-UI components (rendered by <Renderer> in MessageList) instead of markdown.
 *
 * GENUI_SUFFIX is the *static* tail of openuiChatLibrary.prompt() — OpenUI Lang syntax +
 * the component catalog + our house rules — precomputed in genui-suffix.ts (see
 * scripts/gen-genui-suffix.mjs). Keeping it precomputed means server route handlers import
 * only a string, never the OpenUI *client* component library (which pulls recharts/radix/
 * react-dom and would break the Next.js server build). The model-facing prompt is identical
 * to calling openuiChatLibrary.prompt({ preamble: basePrompt, additionalRules }).
 */
export function withGenerativeUi(basePrompt: string): string {
  return basePrompt + GENUI_SUFFIX;
}

/** ESG Buddy's OpenUI-Lang system prompt (static preamble → computed once at module load). */
export const ESG_BUDDY_GENUI_SYSTEM = withGenerativeUi(ESG_BUDDY_SYSTEM);
