/**
 * Hand-rolled body_markdown parser: headings, blank-line-delimited
 * paragraphs, and `story:<type>` fenced directive blocks (JSON body, mounted
 * via the viz-engine module registry — see components/stories/story-body.tsx).
 *
 * Can't reuse @vismay/viz-engine's extractFsDirectives/FS_FENCE_OPEN as-is:
 * that regex hardcodes the `fs:` prefix, and the function returns a flat
 * directive list with no interleaved prose — it's designed to be called from
 * inside a separate line-scanning loop, not to be one itself. This is that
 * loop, adapted with our own `story:` prefix.
 */

export type StoryBlock =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "directive"; type: string; config: Record<string, unknown> };

const STORY_FENCE_OPEN = /^```(story:[a-z0-9-]+)\b/;
const FENCE_CLOSE = /^```\s*$/;

export function parseStoryBody(markdown: string): StoryBlock[] {
  const blocks: StoryBlock[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];

  const flush = () => {
    if (para.length) blocks.push({ kind: "paragraph", text: para.join(" ").trim() });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const fence = STORY_FENCE_OPEN.exec(line);
    if (fence) {
      flush();
      const type = fence[1]!;
      const body: string[] = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        if (FENCE_CLOSE.test(lines[j]!)) break;
        body.push(lines[j]!);
      }
      i = j;
      const parsed = parseStoryFenceBody(type, body.join("\n"));
      if (parsed) blocks.push({ kind: "directive", ...parsed });
      continue;
    }

    if (line.trim() === "") {
      flush();
      continue;
    }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      blocks.push({ kind: "heading", level: h[1]!.length >= 3 ? 3 : 2, text: h[2]!.trim() });
      continue;
    }

    para.push(line.trim());
  }
  flush();
  return blocks;
}

/** Malformed fence bodies degrade to "skip it" rather than rendering raw or
 *  throwing — same contract as viz-engine's own fence parser. */
function parseStoryFenceBody(
  type: string,
  body: string
): { type: string; config: Record<string, unknown> } | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return { type, config: { ...(value as Record<string, unknown>), type } };
}
