import type { ComposerSkill } from "./ChatComposer";

/**
 * v1 "/" skills for the Chat composer — prompt starters that prefill/steer the
 * message. No backend or model change: the ESG Buddy system + draftDataRequest
 * tool already handle these; the skills just shape the ask. Mapped to the real
 * GreenMentor agent families / buddy capabilities.
 */
export const CHAT_SKILLS: ComposerSkill[] = [
  { id: "data-request", label: "Draft data request", hint: "Structured ESG data request", template: "Draft a structured ESG data request for" },
  { id: "explain", label: "Explain", hint: "Plain-English explainer", template: "Explain in plain terms:" },
  { id: "materiality", label: "Materiality", hint: "Think through a materiality assessment", template: "Help me think through a materiality assessment for" },
  { id: "scope3", label: "Scope 3", hint: "Which categories apply", template: "Which Scope 3 categories apply to" },
  { id: "report-draft", label: "Report draft", hint: "Draft disclosure narrative", template: "Draft report narrative text for the disclosure:" },
];
