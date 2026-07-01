// Shared, dependency-free defaults for the Chat welcome suggestion chips. Safe to
// import from both the client component (SuggestionChips) and the server
// generator — keep it free of any server-only imports.

/**
 * Fallback quick-start prompts. Rendered instantly on first paint and whenever
 * AI-generated, personalized suggestions are unavailable, so the welcome chips
 * are never empty.
 */
export const FALLBACK_SUGGESTIONS: string[] = [
  "Explain BRSR Principle 6 in plain terms",
  "Draft a data request for monthly grid electricity",
  "What goes into a materiality assessment?",
  "Summarize Scope 1, 2 and 3 for a manufacturer",
];

/** How many chips the welcome screen shows. */
export const SUGGESTION_COUNT = 4;
