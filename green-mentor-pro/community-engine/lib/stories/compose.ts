import type { StorySourceRow } from "@/lib/db/story-sources";

const MAX_SOURCE_CHARS = 6_000;
const MAX_TOTAL_CHARS = 20_000;

/** Concatenates extracted source text into one grounding block for an LLM
 *  prompt, truncated per-source and in total so a handful of long articles
 *  can't blow out the context window. */
export function buildSourcesContext(sources: StorySourceRow[]): string {
  let remaining = MAX_TOTAL_CHARS;
  const parts: string[] = [];
  for (const s of sources) {
    if (remaining <= 0) break;
    const text = (s.extracted_text ?? "").trim();
    if (!text) continue;
    const clipped = text.slice(0, Math.min(MAX_SOURCE_CHARS, remaining));
    const label = s.title?.trim() || s.url || "Pasted text";
    parts.push(`Source: ${label}\n${clipped}`);
    remaining -= clipped.length;
  }
  return parts.join("\n\n---\n\n");
}

const MAX_EXTRACTED_CHARS = 20_000;

/** Best-effort HTML → plaintext for a fetched link source. No readability
 *  library — strips script/style blocks and tags, collapses whitespace. */
export function htmlToPlainText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return stripped
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_EXTRACTED_CHARS);
}
