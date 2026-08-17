import type { SourceDoc } from "@vismay/story-pipeline";
import type { StorySourceRow } from "@/lib/db/story-sources";

/**
 * Glue between CE's community_stories storage and @vismay/story-pipeline's
 * pure generation functions. The pipeline is text-in/text-out — storage
 * orchestration stays here (adapted from vismay admin's compose/shared.ts,
 * JSON path only: GM stories are JSON-native).
 */

/** Map persisted story_sources rows to the pipeline's SourceDoc shape,
 *  keeping only rows with extracted text. `pipeline` rows are ingested
 *  articles — links as far as the model is concerned. */
export function storySourceRowsToDocs(rows: StorySourceRow[]): SourceDoc[] {
  return rows
    .filter((r) => r.status === "extracted" && !!r.extracted_text)
    .map((r) => ({
      origin: r.url ?? r.title ?? r.id,
      kind: r.kind === "text" ? ("text" as const) : ("link" as const),
      title: r.title ?? "Untitled",
      body: r.extracted_text ?? "",
    }));
}

// ── In-place section surgery (per-section CONTENT/VISUAL passes) ──────────
// Section anchors are level-1 OR level-2 headings, mirroring contentAnchors.
const HEADING_RE = /^##?\s+/;

function sectionSpan(lines: string[], heading: string): [number, number] | null {
  const h = heading.trim();
  const start = lines.findIndex(
    (l) => HEADING_RE.test(l) && l.replace(HEADING_RE, "").trim() === h
  );
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (HEADING_RE.test(lines[i])) {
      end = i;
      break;
    }
  }
  return [start, end];
}

/** Whether the markdown still contains a `## heading` anchor. Used to fail
 *  loudly before generation when an editor renamed the heading in the
 *  document pane — `replaceMarkdownProse` would otherwise silently no-op and
 *  the section would render empty prose. */
export function hasMarkdownSection(markdown: string, heading: string): boolean {
  return sectionSpan(markdown.split("\n"), heading) !== null;
}

/** Replace the prose under a `## heading` (CONTENT pass writes the markdown). */
export function replaceMarkdownProse(
  markdown: string,
  heading: string,
  paragraphs: string[]
): string {
  const lines = markdown.split("\n");
  const span = sectionSpan(lines, heading);
  if (!span) return markdown;
  const hashes = lines[span[0]].match(/^#+/)?.[0] ?? "##";
  const body = paragraphs.map((p) => p.trim()).filter(Boolean).join("\n\n");
  const block = [`${hashes} ${heading.trim()}`, "", body, ""];
  return [...lines.slice(0, span[0]), ...block, ...lines.slice(span[1])].join("\n");
}

/** Read the current prose under a `## heading` (grounds the VISUAL pass). */
export function readMarkdownProse(markdown: string, heading: string): string[] {
  const lines = markdown.split("\n");
  const span = sectionSpan(lines, heading);
  if (!span) return [];
  return lines
    .slice(span[0] + 1, span[1])
    .join("\n")
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Flatten the foreground layer types out of a generated section visual body
 *  (regions form or flat array). Drives the gm-layers-only corrective retry. */
export function visualBodyLayerTypes(body: Record<string, unknown>): string[] {
  const fg = body.foreground;
  let layers: unknown[] = [];
  if (Array.isArray(fg)) {
    layers = fg;
  } else if (fg && typeof fg === "object" && "regions" in (fg as object)) {
    const regions = (fg as { regions: Record<string, unknown> }).regions ?? {};
    layers = Object.values(regions).flatMap((r) => {
      if (Array.isArray(r)) return r;
      if (r && typeof r === "object" && "layers" in (r as object)) {
        const inner = (r as { layers: unknown }).layers;
        return Array.isArray(inner) ? inner : [];
      }
      return [r];
    });
  } else if (fg) {
    layers = [fg];
  }
  return layers
    .map((l) => (l as { type?: unknown } | null)?.type)
    .filter((t): t is string => typeof t === "string");
}

interface JsonConfig {
  defaults?: unknown;
  sections?: Array<Record<string, unknown>>;
}

function parseConfig(configText: string): JsonConfig {
  const parsed = JSON.parse(configText) as JsonConfig;
  if (!parsed || typeof parsed !== "object") throw new Error("config is not an object");
  return parsed;
}

/** The markdown anchor a config section's prose lives under (`text` field). */
export function sectionAnchor(configText: string, sectionId: string): string | null {
  const config = parseConfig(configText);
  const section = config.sections?.find((s) => s.id === sectionId);
  const text = section?.text;
  return typeof text === "string" ? text : null;
}

/**
 * Replace a section's visual body in the config, keyed by id, preserving
 * id/text. GM configs are JSON-native, so this edits the parsed tree and
 * re-serializes with the editor's 2-space convention.
 */
export function replaceConfigBody(
  configText: string,
  sectionId: string,
  body: Record<string, unknown>
): string {
  const config = parseConfig(configText);
  const sections = config.sections ?? [];
  const index = sections.findIndex((s) => s.id === sectionId);
  if (index < 0) throw new Error(`section "${sectionId}" not found in config`);
  const existing = sections[index];
  const entry: Record<string, unknown> = { id: existing.id };
  if (existing.text) entry.text = existing.text;
  if (existing.kind) entry.kind = existing.kind;
  for (const [k, v] of Object.entries(body)) {
    if (k !== "id" && k !== "text") entry[k] = v;
  }
  const next = [...sections];
  next[index] = entry;
  return JSON.stringify({ ...config, sections: next }, null, 2);
}
