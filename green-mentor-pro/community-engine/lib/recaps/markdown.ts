/**
 * Deterministic rendering of a recap's structured topics. The model writes the
 * topic analysis (title/summary/keyFacts); code owns document structure and
 * every citation list — a source link is grounded data, never model prose.
 */

import type { RecapRow, RecapTopic } from "../db/recaps";
import { findRecapCategory } from "./framework";

function categoryName(topic: RecapTopic): string {
  return findRecapCategory(topic.category)?.name ?? topic.category;
}

function refUrl(ref: RecapTopic["sourceRefs"][number]): string {
  return ref.url;
}

/** The full recap document, stored in `community_recaps.markdown`. */
export function buildRecapMarkdown(input: {
  title: string;
  period_start: string;
  period_end: string;
  topics: RecapTopic[];
}): string {
  const lines: string[] = [];
  lines.push(`# ${input.title}`);
  lines.push("");
  lines.push(`_Week of ${input.period_start} to ${input.period_end}_`);
  for (const topic of input.topics) {
    lines.push("");
    lines.push(`## ${topic.title}`);
    lines.push("");
    lines.push(`_Category: ${categoryName(topic)}_`);
    lines.push("");
    lines.push(topic.summary);
    if (topic.keyFacts.length > 0) {
      lines.push("");
      for (const fact of topic.keyFacts) lines.push(`- ${fact}`);
    }
    if (topic.sourceRefs.length > 0) {
      lines.push("");
      lines.push("**Sources:**");
      lines.push("");
      for (const ref of topic.sourceRefs) lines.push(`- [${ref.title}](${refUrl(ref)})`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * The condensed rendering stored as a story source's `extracted_text` when a
 * recap is attached. Citation URL lists are deliberately omitted: generation
 * clips each source at 12k chars (engine 2) / 6k (engine 1), and the point of
 * this text is that EVERY topic survives the clip — the full document stays
 * readable via GET /api/recaps/[id], and the chosen topic's sources get
 * attached as real story_sources anyway.
 */
export function condenseRecapForSource(recap: RecapRow): string {
  const lines: string[] = [];
  lines.push(`${recap.title} (week of ${recap.period_start} to ${recap.period_end})`);
  for (const topic of recap.topics) {
    lines.push("");
    lines.push(`## ${topic.title}`);
    lines.push(`Category: ${categoryName(topic)}`);
    lines.push(topic.summary);
    for (const fact of topic.keyFacts) lines.push(`- ${fact}`);
  }
  return lines.join("\n");
}
