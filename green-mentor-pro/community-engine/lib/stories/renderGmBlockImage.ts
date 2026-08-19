import { FONT, GREEN, INK, PAPER } from "@gm/story-vertical/tokens";
import { screenshotBlock } from "./renderBlockImage";

/**
 * Rasterize the `gm:*` bands whose LOOK is the content, for the Substack export.
 *
 * Substack strips classes and most inline styles on paste, so a band whose meaning
 * lives in its typography and chrome — the split cover, the hard-bordered figure
 * cards, a chart — cannot survive as markup. Those become a hosted PNG. Everything
 * else serializes to semantic HTML, which Substack renders natively and a reader can
 * select, search, translate and reflow (see serializeVismaySubstack.ts).
 *
 * The HTML here is hand-written rather than a render of the React components: those
 * are client components with hooks, and server-rendering them would mean a second
 * rendering path. Colours come from the SHARED tokens, so the two can only drift on
 * layout, never on brand.
 *
 * Self-contained pages, like renderBlockImage.ts: no navigated URL and no network
 * fetch, so a serverless invocation never blocks on Google Fonts. The consequence is
 * a system font stack rather than Syne/Instrument Serif — embedding those faces would
 * add a base64 web font to every render, which is a real size cost for an emailed
 * newsletter. Layout, colour and hierarchy carry the brand.
 */

/** Blocks this module rasterizes. Everything else goes out as semantic HTML. */
export const GM_IMAGE_BLOCK_TYPES = new Set(["gm:hero", "gm:statGrid", "chart"]);

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// System stack — see the note above on why no webfont is fetched.
const SANS = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
const SERIF = `Georgia, "Times New Roman", serif`;

function doc(inner: string): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8"><style>` +
    `*{margin:0;padding:0;box-sizing:border-box}body{background:${PAPER.white};font-family:${SANS}}` +
    `</style></head><body>${inner}</body></html>`
  );
}

/**
 * The corpus's emphasis move: `*spans*` in a headline become italic serif in the
 * accent green. Mirrors `renderEmphasis` in the vertical's text.tsx, in HTML.
 */
function emphasis(text: string, color: string): string {
  return text
    .split(/(\*[^*]+\*)/g)
    .map((part) =>
      part.startsWith("*") && part.endsWith("*") && part.length > 2
        ? `<em style="font-family:${SERIF};font-style:italic;font-weight:400;color:${color}">${esc(part.slice(1, -1))}</em>`
        : esc(part)
    )
    .join("");
}

/** The cover: green top strip, dark headline column, green issue panel. */
function heroHtml(c: Record<string, unknown>): { html: string; width: number; height: number } {
  const width = 1200;
  const height = 630;
  const str = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
  const tags = Array.isArray(c.tags) ? (c.tags as unknown[]).filter((t) => typeof t === "string") : [];

  const strip = str("brandLine")
    ? `<div style="background:${GREEN.base};display:flex;justify-content:space-between;align-items:center;padding:12px 44px">
         <span style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.65)">${esc(str("brandLine"))}</span>
       </div>`
    : "";
  const sub = str("subtitle")
    ? `<p style="font-size:19px;line-height:1.6;color:rgba(255,255,255,0.5);max-width:30em;margin-top:20px">${esc(str("subtitle"))}</p>`
    : "";
  const tagHtml = tags.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:32px">${tags
        .map(
          (t) =>
            `<span style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.5);padding:6px 12px;border-radius:40px">${esc(String(t))}</span>`
        )
        .join("")}</div>`
    : "";
  const issue = str("issueNumber");
  const panel = `<div style="background:${GREEN.base};position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 24px">
      <span style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.5);position:relative;z-index:1">${esc(str("issueLabel") || "Issue")}</span>
      <span style="font-size:40px;font-weight:800;color:#fff;position:relative;z-index:1;margin-top:8px">${esc(issue)}</span>
      <span style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:10px;text-align:center;position:relative;z-index:1">${esc(str("issueDate"))}</span>
      ${
        issue
          ? `<span style="position:absolute;bottom:-24px;right:8px;font-size:150px;font-weight:800;line-height:1;letter-spacing:-0.05em;color:rgba(255,255,255,0.08)">${esc(issue)}</span>`
          : ""
      }
    </div>`;

  const inner = `<div id="block" style="width:${width}px;height:${height}px;display:flex;flex-direction:column;background:${INK.black}">
    ${strip}
    <div style="flex:1;min-height:0;display:grid;grid-template-columns:1fr 230px">
      <div style="padding:48px 44px;display:flex;flex-direction:column;justify-content:center">
        <p style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${GREEN.light};margin-bottom:22px">${esc(str("brandLine"))}</p>
        <h1 style="font-size:56px;font-weight:800;line-height:1.06;letter-spacing:-0.03em;color:#fff;max-width:15em">${emphasis(str("title"), GREEN.light)}</h1>
        ${sub}${tagHtml}
      </div>
      ${panel}
    </div>
  </div>`;
  return { html: doc(inner), width, height };
}

/** The figure cards: hard 1.5px border, green numeral, mono unit, note. */
function statGridHtml(c: Record<string, unknown>): { html: string; width: number; height: number } {
  const stats = (Array.isArray(c.items) ? c.items : []) as Array<Record<string, unknown>>;
  const width = 1200;
  // `columns` when the author set it, else the card count capped like the renderer.
  const declared = typeof c.columns === "number" ? c.columns : 0;
  const cols = declared || (stats.length >= 3 ? 2 : Math.max(1, stats.length));
  const rows = Math.ceil(stats.length / cols);
  const height = 60 + rows * 210;
  const str = (o: Record<string, unknown>, k: string) =>
    typeof o[k] === "string" ? (o[k] as string) : typeof o[k] === "number" ? String(o[k]) : "";

  const cards = stats
    .map(
      (s) => `<div style="border:1.5px solid ${INK.black};border-radius:6px;background:${PAPER.white};padding:28px 26px">
        <div style="font-size:52px;font-weight:800;letter-spacing:-0.02em;line-height:1;color:${GREEN.base};margin-bottom:12px">${esc(str(s, "value"))}${
          // `unit` is the small suffix beside the figure ("/177", "MtCO₂e") — the
          // corpus prints it smaller and grey inside the number.
          str(s, "unit")
            ? `<span style="font-size:0.42em;color:${INK.muted}">${esc(str(s, "unit"))}</span>`
            : ""
        }</div>
        <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:${INK.muted};margin-bottom:12px">${esc(str(s, "label"))}</div>
        <p style="font-size:15px;line-height:1.7;color:${INK.prose}">${esc(str(s, "note"))}</p>
      </div>`
    )
    .join("");

  const inner = `<div id="block" style="width:${width}px;padding:30px 44px;background:${PAPER.white}">
    <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:16px">${cards}</div>
  </div>`;
  return { html: doc(inner), width, height };
}

/**
 * A chart, rendered by ECharts' own SERVER-SIDE renderer.
 *
 * The stored payload is a compiled ECharts option, so faithful output means running
 * ECharts — rebuilding a chart from its option by hand would be a second, worse chart
 * engine. But it does NOT mean running a browser: `ssr: true` +
 * `renderToSVGString()` produces the finished SVG in-process, with no DOM.
 *
 * That matters practically. Inlining echarts' dist into a Playwright page would need
 * the file traced into the serverless function (the same class of problem the
 * chromium binaries have) and would ship ~1MB of library per render. This ships
 * nothing: the SVG goes into a tiny page the shared screenshot path rasterizes,
 * because Substack strips inline SVG on paste.
 *
 * viz-engine's `$`-prefixed theme tokens are resolved to the GreenMentor palette
 * first, since there is no ChartColorsProvider outside the reader.
 */
const TOKEN_COLORS: Record<string, string> = {
  $accent: GREEN.base,
  $accent2: GREEN.mid,
  $teal: GREEN.mid,
  $positive: GREEN.light,
  $amber: "#b8860b",
  $red: "#a83232",
  $muted: INK.muted,
  $line: "rgba(14,14,12,0.1)",
  $surface: PAPER.offWhite,
  $bg: PAPER.white,
  $text: INK.black,
};

function resolveTokens(value: unknown): unknown {
  if (typeof value === "string") return TOKEN_COLORS[value] ?? value;
  if (Array.isArray(value)) return value.map(resolveTokens);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = resolveTokens(v);
    return out;
  }
  return value;
}

async function chartHtml(
  payload: unknown
): Promise<{ html: string; width: number; height: number }> {
  const steps = (payload as { steps?: Array<{ title?: string; option?: unknown }> })?.steps ?? [];
  // The last step is the settled state — a scrollytelling chart's earlier steps are
  // partial reveals, and a newsletter wants the finished figure.
  const step = steps[steps.length - 1];
  if (!step?.option) throw new Error("chart payload has no option to render");

  const width = 1200;
  const chartHeight = 520;
  const echarts = await import("echarts");
  const chart = echarts.init(null, null, {
    renderer: "svg",
    ssr: true,
    width: width - 64,
    height: chartHeight,
  });
  const option = resolveTokens(step.option) as Parameters<typeof chart.setOption>[0];
  chart.setOption({ ...(option as object), animation: false });
  const svg = chart.renderToSVGString();
  chart.dispose();

  const title = step.title
    ? `<div style="font-size:19px;font-weight:700;color:${INK.black};padding:0 8px 18px">${esc(step.title)}</div>`
    : "";
  const inner = `<div id="block" style="width:${width}px;padding:28px 32px;background:${PAPER.white}">${title}${svg}</div>`;
  return { html: doc(inner), width, height: chartHeight + 90 };
}

/** Rasterize one gm block. Throws for a type this module doesn't handle. */
export async function renderGmBlockImage(type: string, config: unknown): Promise<Buffer> {
  if (type === "gm:hero") {
    const { html, width, height } = heroHtml(config as Record<string, unknown>);
    return screenshotBlock(html, { width, height });
  }
  if (type === "gm:statGrid") {
    const { html, width, height } = statGridHtml(config as Record<string, unknown>);
    return screenshotBlock(html, { width, height });
  }
  if (type === "chart") {
    const { html, width, height } = await chartHtml(config);
    return screenshotBlock(html, { width, height });
  }
  throw new Error(`renderGmBlockImage: unsupported block type "${type}"`);
}

void FONT;
