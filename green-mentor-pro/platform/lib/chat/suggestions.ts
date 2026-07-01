import { generateObject } from "ai";
import { z } from "zod";
import { resolveBuddyModel } from "@gm/agents";
import { FALLBACK_SUGGESTIONS, SUGGESTION_COUNT } from "./suggestion-defaults";

export interface SuggestionContext {
  /** Onboarding audience segment, e.g. "mid-career", "business-leader", "student". */
  segment?: string | null;
  /** Onboarding goal ids, e.g. ["framework-mastery", "disclosure-readiness"]. */
  goals?: string[];
  /** Titles of the user's most recent chats, newest first — a light topical signal. */
  recentTitles?: string[];
}

const schema = z.object({
  suggestions: z
    .array(z.string())
    .describe(`Exactly ${SUGGESTION_COUNT} short quick-start prompts a user could tap`),
});

// Human-readable labels for the onboarding ids, so the model gets meaning not slugs.
// Kept local (rather than importing the client onboarding-data module) so this
// server file stays free of React/icon imports.
const SEGMENT_LABEL: Record<string, string> = {
  student: "a student building ESG foundations",
  "mid-career": "a mid-career professional pivoting into ESG",
  "business-leader": "a business leader running a sustainability program",
};

const GOAL_LABEL: Record<string, string> = {
  "career-pivot": "pivot their career into ESG",
  "framework-mastery": "master reporting frameworks",
  "csr-strategy": "build a CSR strategy at their company",
  "disclosure-readiness": "get disclosure-ready",
  certification: "earn a recognized certification",
  "cv-projects": "add ESG projects to their CV",
  "team-upskilling": "upskill their team",
  exploration: "explore the ESG space",
};

/** Turn the raw context into a short natural-language brief for the model. */
function describe(ctx: SuggestionContext): string {
  const bits: string[] = [];
  const seg = ctx.segment ? SEGMENT_LABEL[ctx.segment] : null;
  if (seg) bits.push(`The user is ${seg}.`);
  const goals = (ctx.goals ?? []).map((g) => GOAL_LABEL[g]).filter(Boolean);
  if (goals.length) bits.push(`Their stated goals: ${goals.join("; ")}.`);
  const titles = (ctx.recentTitles ?? [])
    .filter((t) => t && t.toLowerCase() !== "new chat")
    .slice(0, 5);
  if (titles.length) bits.push(`Recently they asked about: ${titles.join("; ")}.`);
  return bits.join(" ") || "No profile signal yet — keep the suggestions broadly useful.";
}

/** Clean, dedupe, and pad the model output to exactly SUGGESTION_COUNT items. */
function normalize(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const s = raw
      .trim()
      .replace(/^["'\s\d.)-]+/, "") // strip leading quotes / list numbering
      .replace(/["'\s]+$/, "")
      .replace(/[.]+$/, "")
      .replace(/\s+/g, " ");
    if (!s || s.length > 70) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length === SUGGESTION_COUNT) break;
  }
  // Pad from the fallback list if the model under-delivered.
  for (const f of FALLBACK_SUGGESTIONS) {
    if (out.length === SUGGESTION_COUNT) break;
    if (!seen.has(f.toLowerCase())) {
      seen.add(f.toLowerCase());
      out.push(f);
    }
  }
  return out.slice(0, SUGGESTION_COUNT);
}

/**
 * Generate personalized quick-start prompts for the Chat welcome screen using the
 * same model gateway as ESG Buddy. Failure-tolerant by design: any model or
 * credential error falls back to a fixed, always-sensible list so the welcome
 * chips are never empty (mirrors generateConversationTitle).
 */
export async function generateChatSuggestions(ctx: SuggestionContext = {}): Promise<string[]> {
  try {
    const { model } = resolveBuddyModel();
    const { object } = await generateObject({
      model,
      schema,
      system:
        "You are ESG Buddy, GreenMentor's assistant for ESG and sustainability reporting " +
        "(India's BRSR, plus GRI, ISSB/IFRS S1-S2, TCFD, ESRS/CSRD, and GHG Scopes 1-3). " +
        `Write exactly ${SUGGESTION_COUNT} quick-start prompts a user could tap to begin a chat. ` +
        "Rules: each prompt is written as the USER speaking to ESG Buddy (a direct question or an " +
        '"ask" like "Draft…", "Explain…", "Help me…"); concise (max ~9 words, no trailing period); ' +
        "specific and grounded in real ESG frameworks/disclosures. Make the four varied — a mix of an " +
        "explainer, a framework/disclosure question, a hands-on drafting task, and a calculation or " +
        "Scope 1/2/3 question. No numbering, no quotes, no preamble.",
      prompt: `Context about the user:\n${describe(ctx)}\n\nReturn ${SUGGESTION_COUNT} prompts.`,
    });
    const cleaned = normalize(object.suggestions ?? []);
    return cleaned.length === SUGGESTION_COUNT ? cleaned : FALLBACK_SUGGESTIONS;
  } catch {
    return FALLBACK_SUGGESTIONS;
  }
}
