import { parseJsonConfig, type JsonConfigSection } from "@vismay/content-source/jsonSections";
import { readMarkdownProse } from "./pipeline-store";
import { renderGmBlockImage } from "./renderGmBlockImage";
import { uploadStoryAsset } from "./renderBlockImage";

/**
 * Serialize a `body_format: 'vismay'` story into Substack-friendly HTML.
 *
 * This is the SECOND OUTPUT of one composition: the same markdown + config that
 * renders as a scroll-through story on the platform also becomes a pasteable
 * newsletter. Nothing is authored twice.
 *
 * The split is decided by what survives a Substack paste. Substack keeps semantic
 * tags (h2/h3, p, blockquote, ul/ol/li, dl, table, hr, a, strong/em, img) and strips
 * classes and most inline styles. So:
 *
 *   - Bands whose MEANING is typographic or chromatic — the split cover, the
 *     hard-bordered figure cards, a chart — are rasterized to a hosted PNG.
 *   - Everything else becomes semantic markup, which is strictly better than an
 *     image: selectable, searchable, translatable, reflows on a phone, and readable
 *     in a plain-text email client.
 *
 * The band ORDER is the config's, not the markdown's — `config.sections` is what the
 * reader walks, and materialise inserts a band's config entry in reading position
 * while appending its markdown at the end of the document.
 *
 * Async because the rasterized blocks await a screenshot + upload, and sequential so
 * an image-heavy story never launches several browsers at once.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Escape, then apply the inline subset the gm modules accept. */
function inline(raw: string): string {
  let s = esc(raw);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) => `<a href="${u}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  return s;
}

/**
 * The corpus writes headline emphasis as `*spans*`, which the reader typesets as
 * italic serif in the accent green. Substack keeps `<em>`, so the span survives —
 * the accent colour does not, and that is fine.
 */
function stripEmphasis(text: string): string {
  return text
    .split(/(\*[^*]+\*)/g)
    .map((part) =>
      part.startsWith("*") && part.endsWith("*") && part.length > 2
        ? `<em>${esc(part.slice(1, -1))}</em>`
        : esc(part)
    )
    .join("");
}

type Layer = { type?: unknown } & Record<string, unknown>;

const str = (o: Layer, k: string) => (typeof o[k] === "string" ? (o[k] as string).trim() : "");
const strings = (o: Layer, k: string): string[] =>
  Array.isArray(o[k]) ? (o[k] as unknown[]).filter((v): v is string => typeof v === "string") : [];
const arr = (o: Layer, k: string): Layer[] =>
  Array.isArray(o[k]) ? ((o[k] as unknown[]).filter((v) => v && typeof v === "object") as Layer[]) : [];

/**
 * NOTE on shapes. A gm story's config uses `background: [{ type: 'gm:surface' }]`
 * (an array) and puts every foreground layer in the `default` region of the `free`
 * layout — the gm modules are self-framing band renderers. The walkers below stay
 * tolerant of the other shapes `normalizeSectionBody` can emit (a bare layer, a flat
 * array, a named-region map), because a freshly-generated section can arrive in any
 * of them before `applyGmBandRhythm` canonicalises it.
 */

/** Foreground layers of a section, in region order. */
function layersOf(section: JsonConfigSection): Layer[] {
  const fg = section.foreground;
  if (Array.isArray(fg)) return fg as Layer[];
  if (!fg || typeof fg !== "object") return [];
  const regions = (fg as { regions?: Record<string, unknown> }).regions;
  if (!regions) return [fg as Layer];
  const out: Layer[] = [];
  for (const v of Object.values(regions)) {
    for (const l of Array.isArray(v) ? v : [v]) if (l && typeof l === "object") out.push(l as Layer);
  }
  return out;
}

export interface VismaySerializeCtx {
  storyId: string;
  /** The full stored document — frontmatter + markdown body. */
  markdown: string;
  /** The story config, as stored (JSON text). */
  configText: string;
  /** Chart payloads by chart id, for rasterizing `chart` layers. */
  charts: Record<string, unknown>;
}

/** Rasterize a block and return an `<img>`, or "" when it can't be rendered. */
async function imageBlock(
  type: string,
  config: unknown,
  alt: string,
  caption: string,
  ctx: VismaySerializeCtx
): Promise<string> {
  try {
    const png = await renderGmBlockImage(type, config);
    const url = await uploadStoryAsset(ctx.storyId, type, config, png);
    const fig = caption ? `<figcaption>${esc(caption)}</figcaption>` : "";
    return `<figure><img src="${url}" alt="${esc(alt)}" />${fig}</figure>`;
  } catch {
    // A render failure must not lose the whole export — the band is skipped, and
    // every other band still pastes.
    return "";
  }
}

/** `gm:footer.closingNote` is `{ emoji?, text, signature? }`. */
function closingNote(layer: Layer): string {
  const note = layer.closingNote;
  if (!note || typeof note !== "object") return "";
  const n = note as Layer;
  const text = str(n, "text");
  if (!text) return "";
  const emoji = str(n, "emoji");
  const signature = str(n, "signature");
  return (
    `<p>${emoji ? `${esc(emoji)} ` : ""}${inline(text)}</p>` +
    (signature ? `<p><em>${esc(signature)}</em></p>` : "")
  );
}

/** The eyebrow + accented h2 head that every titled gm band shares. */
function head(layer: Layer): string {
  const eyebrow = str(layer, "eyebrow");
  const title = str(layer, "title");
  return (
    (eyebrow ? `<p><strong>${esc(eyebrow.toUpperCase())}</strong></p>` : "") +
    (title ? `<h2 style="color:#2c6e3f">${stripEmphasis(title)}</h2>` : "")
  );
}

async function layerToHtml(
  layer: Layer,
  section: JsonConfigSection,
  ctx: VismaySerializeCtx
): Promise<string> {
  const type = typeof layer.type === "string" ? layer.type : "";
  const anchor = typeof section.text === "string" ? section.text : "";
  const prose = anchor ? readMarkdownProse(ctx.markdown, anchor) : [];

  switch (type) {
    // ── Rasterized ──────────────────────────────────────────────────────────
    case "gm:hero": {
      const title = str(layer, "title");
      // The cover becomes the newsletter's title block: an image for the look, then
      // the headline as a real <h1> so it is the email's subject-line-shaped text
      // and survives an image-blocking client. The alt text is the bare words —
      // `*spans*` are typography, not content.
      const img = await imageBlock(type, layer, title.replace(/\*/g, ""), "", ctx);
      const sub = str(layer, "subtitle") ? `<p>${inline(str(layer, "subtitle"))}</p>` : "";
      return `${img}<h1>${stripEmphasis(title)}</h1>${sub}`;
    }
    case "gm:statGrid":
      return imageBlock(type, layer, "Key figures", "", ctx);
    case "chart": {
      const id = str(layer, "id");
      const payload = id ? ctx.charts[id] : undefined;
      if (!payload) return "";
      return imageBlock("chart", payload, str(layer, "title") || "Chart", str(layer, "title"), ctx);
    }

    // ── Semantic ────────────────────────────────────────────────────────────
    case "gm:standfirst":
      // The thesis. Italic serif in the story; a blockquote is the closest thing
      // Substack renders with the same "this is the frame" weight.
      return `<blockquote><p><em>${inline(str(layer, "text"))}</em></p></blockquote>`;

    case "gm:sectionHeader": {
      return head({ ...layer, title: str(layer, "title") || anchor });
    }

    case "gm:prose": {
      // `paragraphs` omitted means "render the unit's resolved markdown" — the
      // compose pipeline's CONTENT-pass contract.
      const override = Array.isArray(layer.paragraphs)
        ? (layer.paragraphs as unknown[]).filter((p): p is string => typeof p === "string")
        : null;
      return head(layer) + (override ?? prose).map((p) => `<p>${inline(p)}</p>`).join("");
    }

    case "gm:pullquote": {
      const cite = str(layer, "attribution");
      return `<blockquote><p>${inline(str(layer, "text"))}</p>${
        cite ? `<p>— ${esc(cite)}</p>` : ""
      }</blockquote>`;
    }

    case "gm:takeaways": {
      // Items are `{ lead, body }` — the bold lead is the skimmable line.
      const items = arr(layer, "items");
      return (
        head(layer) +
        `<ol>${items
          .map((i) => {
            const lead = str(i, "lead");
            return `<li>${lead ? `<strong>${esc(lead)}</strong> ` : ""}${inline(str(i, "body"))}</li>`;
          })
          .join("")}</ol>`
      );
    }

    case "gm:explainerGrid": {
      // A numbered list, which is what the grid is once its one-inverted-cell
      // accent (a scroll affordance) has nothing to attach to.
      const cards = arr(layer, "cards");
      return (
        head(layer) +
        `<ol>${cards
          .map(
            (c) =>
              `<li><strong>${esc(str(c, "label"))}</strong> — ${inline(str(c, "description"))}</li>`
          )
          .join("")}</ol>`
      );
    }

    case "gm:steps": {
      const steps = arr(layer, "steps");
      return (
        head(layer) +
        `<ol>${steps
          .map((s) => {
            const stepTitle = str(s, "title");
            return `<li>${stepTitle ? `<strong>${esc(stepTitle)}</strong> ` : ""}${inline(str(s, "body"))}</li>`;
          })
          .join("")}</ol>`
      );
    }

    case "gm:definitionGrid": {
      const items = arr(layer, "items");
      return head(layer) + `<dl>${items
        .map(
          (i) => `<dt><strong>${esc(str(i, "term"))}</strong></dt><dd>${inline(str(i, "definition"))}</dd>`
        )
        .join("")}</dl>`;
    }

    case "gm:comparisonTable": {
      const cols = (Array.isArray(layer.columns) ? layer.columns : []).filter(
        (c): c is string => typeof c === "string"
      );
      const rows = (Array.isArray(layer.rows) ? layer.rows : []) as unknown[];
      // `highlightColumn` is a tint in the story; Substack strips cell colour, so the
      // emphasis becomes bold — the same "this is the column that matters" signal.
      const hi = typeof layer.highlightColumn === "number" ? layer.highlightColumn : -1;
      const cell = (tag: "th" | "td", text: string, i: number) =>
        `<${tag}>${i === hi ? `<strong>${inline(text)}</strong>` : inline(text)}</${tag}>`;
      const headRow = `<tr>${cols.map((c, i) => cell("th", c, i)).join("")}</tr>`;
      const body = rows
        .map((r) => {
          const cells = Array.isArray(r) ? r : [];
          return `<tr>${cols
            .map((_c, i) => cell("td", typeof cells[i] === "string" ? (cells[i] as string) : "", i))
            .join("")}</tr>`;
        })
        .join("");
      return head(layer) + `<table><thead>${headRow}</thead><tbody>${body}</tbody></table>`;
    }

    case "gm:callout": {
      const title = str(layer, "title");
      const badge = str(layer, "badge");
      const paragraphs = strings(layer, "paragraphs");
      const items = strings(layer, "items");
      return (
        (title ? `<p><strong>${esc(title)}${badge ? ` — ${esc(badge)}` : ""}</strong></p>` : "") +
        paragraphs.map((p) => `<p>${inline(p)}</p>`).join("") +
        (items.length ? `<ul>${items.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>` : "")
      );
    }

    case "gm:scoreDonut": {
      const value = typeof layer.value === "number" ? layer.value : null;
      const max = typeof layer.max === "number" ? layer.max : 100;
      if (value === null) return "";
      const label = str(layer, "label");
      const note = str(layer, "note");
      return (
        head(layer) +
        `<p><strong>${esc(String(value))} / ${esc(String(max))}</strong>${label ? ` — ${esc(label)}` : ""}</p>` +
        (note ? `<p>${inline(note)}</p>` : "")
      );
    }

    case "gm:audienceStrip": {
      const chips = (Array.isArray(layer.chips) ? layer.chips : []).filter(
        (c): c is string => typeof c === "string"
      );
      if (chips.length === 0) return "";
      return `<hr><p><strong>${esc(str(layer, "label") || "Resonates with")}:</strong> ${chips
        .map(esc)
        .join(" · ")}</p>`;
    }

    case "gm:footer": {
      const cols = arr(layer, "columns");
      return (
        `<hr>` +
        (str(layer, "logo") ? `<p><strong>${stripEmphasis(str(layer, "logo"))}</strong></p>` : "") +
        (str(layer, "tagline") ? `<p>${esc(str(layer, "tagline"))}</p>` : "") +
        cols
          .map((c) => `<p><strong>${esc(str(c, "label"))}</strong><br>${inline(str(c, "body"))}</p>`)
          .join("") +
        closingNote(layer) +
        (str(layer, "copyright") ? `<p>${esc(str(layer, "copyright"))}</p>` : "")
      );
    }

    case "gm:cta": {
      const label = str(layer, "actionLabel");
      const href = str(layer, "actionHref");
      const note = str(layer, "note");
      return (
        head(layer) +
        (str(layer, "body") ? `<p>${inline(str(layer, "body"))}</p>` : "") +
        (label ? `<p><a href="${esc(href) || "#"}"><strong>${esc(label)} →</strong></a></p>` : "") +
        (note ? `<p>${esc(note)}</p>` : "")
      );
    }

    // Core image module — already a hosted URL, so it needs no rasterizing.
    case "image": {
      const src = str(layer, "src");
      // `assets://` refs resolve against a bucket the reader knows about; Substack
      // re-fetches at paste time and would 404 on the scheme.
      if (!src || src.startsWith("assets://")) return "";
      const alt = str(layer, "alt");
      return `<figure><img src="${esc(src)}" alt="${esc(alt)}" /></figure>`;
    }

    // `gm:surface` is the band's background colour — nothing to say in an email.
    default:
      return "";
  }
}

/** Convert a vismay story's stored texts into Substack-pasteable HTML. */
export async function vismayStoryToSubstackHtml(ctx: VismaySerializeCtx): Promise<string> {
  const { sections, parseError } = parseJsonConfig(ctx.configText);
  if (parseError) throw new Error(`config is not valid JSON: ${parseError}`);

  const out: string[] = [];
  for (const section of sections) {
    for (const layer of layersOf(section)) {
      const html = await layerToHtml(layer, section, ctx);
      if (html) out.push(html);
    }
  }
  return out.join("\n");
}
