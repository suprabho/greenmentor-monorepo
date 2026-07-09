/**
 * Serialize a story's body_markdown into Substack-friendly HTML.
 *
 * Substack's paste keeps semantic tags (h2/h3, p, blockquote, ul/ol/li, hr, a,
 * strong/em, img) but strips classes and most inline styles, so this emits plain
 * semantic markup. Blocks Substack can't render inline — `story:hero` (styled
 * banner) and `story:chart` (SVG) — are rasterized to a hosted PNG and emitted
 * as <img> (see lib/stories/renderBlockImage.ts). This is the "hybrid" export.
 *
 * Async because the image blocks await a screenshot + upload. Rendered
 * sequentially so an image-heavy story never launches many browsers at once.
 */
import { parseStoryBody, type StoryBlock } from "./parseBody";
import { renderStoryBlockImage, uploadStoryAsset, IMAGE_BLOCK_TYPES } from "./renderBlockImage";
import { storyImageSchema } from "@/components/stories/modules/image";
import { storyPullquoteSchema } from "@/components/stories/modules/pullquote";
import { storyCtaSchema } from "@/components/stories/modules/cta";
import { storyCalloutSchema } from "@/components/stories/modules/callout";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Escape then apply the inline subset the draft uses: **bold**, *italic* /
 *  _italic_, and [text](url). Operates on already-escaped text, so the markdown
 *  markers (which esc leaves untouched) are the only things transformed. */
function inlineMd(raw: string): string {
  let s = esc(raw);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) => `<a href="${u}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1<em>$2</em>");
  return s;
}

export type SerializeCtx = { storyId: string };

async function directiveToHtml(
  type: string,
  config: Record<string, unknown>,
  ctx: SerializeCtx
): Promise<string> {
  // Image blocks (hero, chart) → rasterize + host, emit <img>.
  if (IMAGE_BLOCK_TYPES.has(type)) {
    const png = await renderStoryBlockImage(type, config);
    const url = await uploadStoryAsset(ctx.storyId, type, config, png);
    const caption = typeof config.title === "string" ? config.title : "";
    const alt = type === "story:hero" && typeof config.title === "string" ? config.title : caption || "Chart";
    const fig = caption && type === "story:chart" ? `<figcaption>${esc(caption)}</figcaption>` : "";
    return `<figure><img src="${url}" alt="${esc(alt)}" />${fig}</figure>`;
  }

  if (type === "story:pullquote") {
    const p = storyPullquoteSchema.safeParse(config);
    if (!p.success) return "";
    const attr = p.data.attribution ? `<p>— ${esc(p.data.attribution)}</p>` : "";
    return `<blockquote><p>${esc(p.data.text)}</p>${attr}</blockquote>`;
  }

  if (type === "story:cta") {
    const p = storyCtaSchema.safeParse(config);
    if (!p.success) return "";
    return `<p><a href="${p.data.href}"><strong>${esc(p.data.label)} →</strong></a></p>`;
  }

  if (type === "story:image") {
    const p = storyImageSchema.safeParse(config);
    if (!p.success) return "";
    const cap = p.data.caption ? `<figcaption>${esc(p.data.caption)}</figcaption>` : "";
    return `<figure><img src="${p.data.src}" alt="${esc(p.data.alt || p.data.caption)}" />${cap}</figure>`;
  }

  if (type === "story:callout") {
    const p = storyCalloutSchema.safeParse(config);
    if (!p.success) return "";
    const title = p.data.title ? `<p><strong>${esc(p.data.title)}</strong></p>` : "";
    const tag = p.data.ordered ? "ol" : "ul";
    const items = p.data.items.map((it) => `<li>${inlineMd(it)}</li>`).join("");
    return `${title}<${tag}>${items}</${tag}>`;
  }

  return ""; // unknown directive → skip (same "degrade to nothing" contract as the renderer)
}

async function blockToHtml(b: StoryBlock, ctx: SerializeCtx): Promise<string> {
  switch (b.kind) {
    case "heading":
      // Inline color is a best-effort brand cue; Substack may drop it, which is fine.
      return b.level === 2
        ? `<h2 style="color:#0b602c">${inlineMd(b.text)}</h2>`
        : `<h3 style="color:#0b602c">${inlineMd(b.text)}</h3>`;
    case "paragraph":
      return `<p>${inlineMd(b.text)}</p>`;
    case "hr":
      return "<hr>";
    case "directive":
      return directiveToHtml(b.type, b.config, ctx);
  }
}

/** Convert body_markdown → a Substack-pasteable HTML string. */
export async function storyBlocksToSubstackHtml(
  markdown: string,
  ctx: SerializeCtx
): Promise<string> {
  const blocks = parseStoryBody(markdown);
  const out: string[] = [];
  for (const b of blocks) {
    const html = await blockToHtml(b, ctx);
    if (html) out.push(html);
  }
  return out.join("\n");
}
