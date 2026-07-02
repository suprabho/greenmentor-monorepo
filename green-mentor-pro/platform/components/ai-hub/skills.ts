import type { ComposerSkill } from "./ChatComposer";

/**
 * "/" skills for the Chat composer — prompt starters that prefill/steer the message.
 * The first three are RUNNABLE skills: their template leads into a message that makes
 * the ESG Buddy call a standalone agent tool (runScopingSkill / extractBillSkill /
 * understandEpdSkill — see buildSkillTools in @gm/orchestrator), which renders a
 * result card. The rest are pure prompt starters the buddy answers conversationally.
 */
export const CHAT_SKILLS: ComposerSkill[] = [
  { id: "scoping", label: "Scope an engagement", hint: "Run the kick-off & scoping skill", template: "Scope a BRSR reporting engagement for" },
  { id: "extract-bill", label: "Extract a bill", hint: "Pull data from a bill/invoice you paste", template: "Extract the ESG data from this document:\n\n" },
  { id: "understand-epd", label: "Understand an EPD", hint: "Summarize an EPD you paste", template: "Explain this Environmental Product Declaration:\n\n" },
  { id: "data-request", label: "Draft data request", hint: "Structured ESG data request", template: "Draft a structured ESG data request for" },
  { id: "explain", label: "Explain", hint: "Plain-English explainer", template: "Explain in plain terms:" },
  { id: "materiality", label: "Materiality", hint: "Think through a materiality assessment", template: "Help me think through a materiality assessment for" },
];
