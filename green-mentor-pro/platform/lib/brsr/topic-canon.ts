/**
 * Canonicalization of BRSR material-topic phrasings (scrape-brsr.ts stage `canon`).
 *
 * Companies phrase the same material issue dozens of ways ("GHG (Greenhouse
 * gases) emissions", "Climate Change", a whole paragraph about mis-selling…).
 * Stage `canon` maps each DISTINCT normalized phrasing once, via a forced
 * Claude tool call, onto this controlled vocabulary — the mapping lives in
 * brsr_topic_canon (topic_norm PK = the cache), so re-runs only ever pay for
 * new strings. The model may propose a new canonical topic when nothing fits;
 * the validator folds trivially-different proposals back onto existing entries
 * (case/punctuation-insensitive) so the vocabulary grows slowly and on purpose.
 */
import type Anthropic from "@anthropic-ai/sdk";

export type Pillar = "environment" | "social" | "governance" | "cross_cutting";

export type VocabEntry = { topic: string; pillar: Pillar };

export const SEED_VOCAB: VocabEntry[] = [
  // environment
  { topic: "Climate Change & GHG Emissions", pillar: "environment" },
  { topic: "Energy Management", pillar: "environment" },
  { topic: "Water & Effluent Management", pillar: "environment" },
  { topic: "Waste & Circular Economy", pillar: "environment" },
  { topic: "Biodiversity & Land Use", pillar: "environment" },
  { topic: "Air Quality & Pollution", pillar: "environment" },
  { topic: "Sustainable Packaging", pillar: "environment" },
  { topic: "Green Products & Services", pillar: "environment" },
  // social
  { topic: "Human Capital & Talent Development", pillar: "social" },
  { topic: "Occupational Health & Safety", pillar: "social" },
  { topic: "Diversity, Equity & Inclusion", pillar: "social" },
  { topic: "Labour Relations & Fair Wages", pillar: "social" },
  { topic: "Human Rights", pillar: "social" },
  { topic: "Community Engagement & CSR", pillar: "social" },
  { topic: "Customer Satisfaction & Experience", pillar: "social" },
  { topic: "Product Quality & Safety", pillar: "social" },
  { topic: "Data Privacy & Cybersecurity", pillar: "social" },
  { topic: "Employee Wellbeing & Engagement", pillar: "social" },
  { topic: "Financial Inclusion & Access", pillar: "social" },
  // governance
  { topic: "Corporate Governance", pillar: "governance" },
  { topic: "Business Ethics & Conduct", pillar: "governance" },
  { topic: "Anti-corruption & Anti-bribery", pillar: "governance" },
  { topic: "Regulatory Compliance", pillar: "governance" },
  { topic: "Risk Management & Internal Controls", pillar: "governance" },
  { topic: "Transparency & Disclosure", pillar: "governance" },
  // cross-cutting
  { topic: "Economic Performance & Growth", pillar: "cross_cutting" },
  { topic: "Brand & Reputation", pillar: "cross_cutting" },
  { topic: "Digitalisation & Technology", pillar: "cross_cutting" },
  { topic: "Innovation & R&D", pillar: "cross_cutting" },
  { topic: "Sustainable Supply Chain", pillar: "cross_cutting" },
  { topic: "Business Continuity & Crisis Management", pillar: "cross_cutting" },
  { topic: "Macroeconomic & Market Volatility", pillar: "cross_cutting" },
  { topic: "Stakeholder Engagement & Materiality", pillar: "cross_cutting" },
  { topic: "Raw Material Availability & Pricing", pillar: "cross_cutting" },
  { topic: "Geopolitical Risk", pillar: "cross_cutting" },
];

const PILLARS: Pillar[] = ["environment", "social", "governance", "cross_cutting"];

/** Case/punctuation-insensitive identity for vocabulary collapse; "&" ≡ "and"
 * so "Climate Change and GHG Emissions" folds onto "Climate Change & GHG Emissions". */
export const vocabKey = (topic: string) =>
  topic.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");

export function buildCanonSystemPrompt(vocab: VocabEntry[]): string {
  const lines = vocab.map((v) => `- ${v.topic} — ${v.pillar}`).join("\n");
  return (
    'You canonicalize "material responsible business conduct issues" disclosed in Indian BRSR (Business Responsibility & Sustainability Report) filings. ' +
    "For each numbered raw topic, pick the single best canonical topic from the vocabulary below. " +
    'Raw topics are messy: synonyms ("GHG emissions" → Climate Change & GHG Emissions; "water consumption" → Water & Effluent Management), ' +
    "abbreviations (CSR, OHS, EHS, D&I), and verbose multi-sentence descriptions — abstract those to the underlying topic " +
    "(e.g. a paragraph about mis-selling products to clients → Business Ethics & Conduct). " +
    "Strongly prefer an existing vocabulary entry, copied VERBATIM. Propose a NEW canonical topic only when nothing reasonably covers the input; " +
    'keep new topics broad, reusable, Title Case, at most 5 words. Never invent an "Other" or "Miscellaneous" bucket. ' +
    "Report confidence below 0.6 when unsure.\n\nVocabulary (topic — pillar):\n" +
    lines +
    "\n\nMap every input line via the map_topics tool."
  );
}

export const MAP_TOPICS_TOOL: Anthropic.Messages.Tool = {
  name: "map_topics",
  description: "Map each raw BRSR material-issue string to one canonical ESG topic and pillar.",
  input_schema: {
    type: "object",
    properties: {
      mappings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "integer", description: "0-based index of the input line" },
            canonical_topic: {
              type: "string",
              description: "A vocabulary entry VERBATIM, or a new concise Title Case topic (<=5 words) only when nothing fits",
            },
            pillar: { type: "string", enum: PILLARS },
            confidence: { type: "number", description: "0-1; use <0.6 when unsure" },
          },
          required: ["index", "canonical_topic", "pillar", "confidence"],
        },
      },
    },
    required: ["mappings"],
  },
};

export type TopicMapping = {
  topicNorm: string;
  canonicalTopic: string;
  pillar: Pillar;
  confidence: number;
};

/**
 * Validate one tool-call result against the input batch. Invalid or missing
 * indexes are simply not returned — those norms stay unmapped and retry on the
 * next run (no poison rows). Proposals that match an existing vocab entry
 * case/punctuation-insensitively collapse onto it (keeping ITS pillar);
 * genuinely new topics come back in `newEntries` for the caller to append to
 * the working vocabulary.
 */
export function validateMappings(
  norms: string[],
  toolInput: unknown,
  vocab: VocabEntry[],
): { mappings: TopicMapping[]; newEntries: VocabEntry[] } {
  const byKey = new Map(vocab.map((v) => [vocabKey(v.topic), v]));
  const seenIndexes = new Set<number>();
  const mappings: TopicMapping[] = [];
  const newEntries: VocabEntry[] = [];

  const raw = (toolInput as { mappings?: unknown })?.mappings;
  if (!Array.isArray(raw)) return { mappings, newEntries };

  for (const item of raw) {
    const { index, canonical_topic, pillar, confidence } = (item ?? {}) as Record<string, unknown>;
    if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= norms.length) continue;
    if (seenIndexes.has(index as number)) continue;
    if (typeof canonical_topic !== "string") continue;
    const proposed = canonical_topic.replace(/\s+/g, " ").trim();
    if (!proposed || proposed.length > 80) continue;
    // Reject bucket-of-last-resort proposals in any dressing — vocabKey strips
    // punctuation, so this also catches "<UNKNOWN>", "N/A", "Un-classified".
    const rejected = ["other", "others", "misc", "miscellaneous", "general", "unknown", "unclassified", "na", "none", "tbd", "notapplicable"];
    if (rejected.includes(vocabKey(proposed))) continue;
    if (!PILLARS.includes(pillar as Pillar)) continue;

    const existing = byKey.get(vocabKey(proposed));
    const entry = existing ?? { topic: proposed, pillar: pillar as Pillar };
    if (!existing) {
      byKey.set(vocabKey(proposed), entry);
      newEntries.push(entry);
    }
    seenIndexes.add(index as number);
    mappings.push({
      topicNorm: norms[index as number],
      canonicalTopic: entry.topic,
      pillar: entry.pillar,
      confidence: Math.min(1, Math.max(0, typeof confidence === "number" ? confidence : 0.5)),
    });
  }
  return { mappings, newEntries };
}
