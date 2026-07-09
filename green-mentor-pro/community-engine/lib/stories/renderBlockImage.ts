/**
 * Renders the story blocks Substack can't show inline (hero, chart) to a PNG
 * and hosts it in the public `story-assets` bucket, returning the URL the
 * serializer drops into an <img src>.
 *
 * Like lib/header/screenshot.ts we screenshot a self-contained HTML string via
 * `page.setContent` (NOT a navigated URL), so there's no render page / handoff /
 * middleware allowlist to maintain, and no cross-origin aura to composite — the
 * hero background is a plain gradient or a remote image the browser fetches, and
 * the chart is inline SVG.
 */
import { createHash } from "node:crypto";
import { launchBrowser } from "@/lib/export/screenshot";
import { createAdminClient } from "@/lib/supabase/admin";
import { storyHeroSchema } from "@/components/stories/modules/hero";
import { storyChartSchema, type StoryChartConfig } from "@/components/stories/modules/chart";

const STORY_ASSETS_BUCKET = "story-assets";

/** Blocks this module knows how to rasterize. Others serialize to semantic HTML. */
export const IMAGE_BLOCK_TYPES = new Set(["story:hero", "story:chart"]);

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const HERO_THEMES: Record<string, { from: string; to: string }> = {
  teal: { from: "#014A50", to: "#0B602C" },
  green: { from: "#0B602C", to: "#07D862" },
  ink: { from: "#0A0A0A", to: "#164E4F" },
};

// System font stack — no webfont fetch, so the serverless render never blocks
// on Google Fonts (a class of FUNCTION_INVOCATION_TIMEOUT the header renderer hit).
const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;

function docHtml(inner: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#fff;font-family:${FONT}}</style></head><body>${inner}</body></html>`;
}

function heroHtml(config: unknown): { html: string; width: number; height: number } {
  const c = storyHeroSchema.parse(config);
  const width = 1200;
  const height = 500;
  const t = HERO_THEMES[c.theme] ?? HERO_THEMES.teal!;
  const bg = c.src
    ? `background-image:url('${esc(c.src)}');background-size:cover;background-position:center;`
    : `background-image:linear-gradient(135deg,${t.from},${t.to});`;
  const scrim = c.src
    ? `<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.72),rgba(0,0,0,0.25),transparent);"></div>`
    : "";
  const eyebrow = c.eyebrow
    ? `<div style="font-size:15px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.82);margin-bottom:14px;">${esc(c.eyebrow)}</div>`
    : "";
  const subtitle = c.subtitle
    ? `<p style="font-size:22px;line-height:1.5;color:rgba(255,255,255,0.88);margin-top:14px;max-width:820px;">${esc(c.subtitle)}</p>`
    : "";
  const inner = `<div id="block" style="position:relative;width:${width}px;height:${height}px;display:flex;flex-direction:column;justify-content:flex-end;padding:56px;${bg}">${scrim}<div style="position:relative;">${eyebrow}<h1 style="font-size:52px;font-weight:800;line-height:1.08;color:#fff;">${esc(c.title)}</h1>${subtitle}</div></div>`;
  return { html: docHtml(inner), width, height };
}

// ---- Chart → single self-contained SVG (ported from modules/chart/Component.tsx) ----

const CATEGORICAL = [
  "#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834",
];
const INK_SECONDARY = "#52514e";
const INK_MUTED = "#898781";
const GRIDLINE = "#e1e0d9";
const AXIS = "#c3c2b7";
const SURFACE = "#ffffff";

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = (rough / mag >= 5 ? 5 : rough / mag >= 2 ? 2 : 1) * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}
function fmt(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

function chartSvg(c: StoryChartConfig): { svg: string; width: number; height: number } {
  const { title, chartType, categories, series } = c;
  const W = 640;
  const titleBand = title ? 30 : 0;
  const legendBand = series.length > 1 ? 30 : 0;
  const padding = { top: titleBand + 16, right: 16, bottom: 32, left: 44 };
  const chartH = 200;
  const H = padding.top + chartH + padding.bottom + legendBand;
  const chartW = W - padding.left - padding.right;

  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max);
  const topTick = ticks[ticks.length - 1] || 1;
  const yFor = (v: number) => padding.top + chartH - (v / topTick) * chartH;
  const groupW = chartW / categories.length;
  const xForGroup = (i: number) => padding.left + groupW * i + groupW / 2;
  const baseline = yFor(0);

  const parts: string[] = [];
  if (title) {
    parts.push(
      `<text x="${padding.left}" y="20" font-size="14" font-weight="600" fill="#0b0b0b">${esc(title)}</text>`
    );
  }
  for (const t of ticks) {
    parts.push(
      `<line x1="${padding.left}" x2="${W - padding.right}" y1="${yFor(t)}" y2="${yFor(t)}" stroke="${GRIDLINE}" stroke-width="1"/>`,
      `<text x="${padding.left - 8}" y="${yFor(t)}" text-anchor="end" dominant-baseline="middle" font-size="11" fill="${INK_MUTED}">${esc(fmt(t))}</text>`
    );
  }
  parts.push(
    `<line x1="${padding.left}" x2="${W - padding.right}" y1="${baseline}" y2="${baseline}" stroke="${AXIS}" stroke-width="1"/>`
  );

  if (chartType === "bar") {
    const gap = 2;
    const barW = Math.min(24, (groupW - gap * (series.length + 1)) / series.length);
    categories.forEach((_, ci) => {
      const groupStart = xForGroup(ci) - (barW * series.length + gap * (series.length - 1)) / 2;
      const maxIdx = series.reduce(
        (best, s, i) => ((s.values[ci] ?? 0) > (series[best]?.values[ci] ?? -Infinity) ? i : best),
        0
      );
      series.forEach((s, si) => {
        const v = s.values[ci] ?? 0;
        const x = groupStart + si * (barW + gap);
        const y = yFor(v);
        const h = Math.max(0, baseline - y);
        parts.push(
          `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="4" fill="${CATEGORICAL[si % CATEGORICAL.length]}"/>`
        );
        if (si === maxIdx) {
          parts.push(
            `<text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="10.5" fill="${INK_SECONDARY}">${esc(fmt(v))}</text>`
          );
        }
      });
    });
  } else {
    series.forEach((s, si) => {
      const color = CATEGORICAL[si % CATEGORICAL.length];
      const pts = categories.map((_, ci) => [xForGroup(ci), yFor(s.values[ci] ?? 0)] as const);
      const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
      parts.push(
        `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
      );
      pts.forEach(([x, y]) => {
        parts.push(`<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="${SURFACE}" stroke-width="2"/>`);
      });
      const [lx, ly] = pts[pts.length - 1] ?? [0, 0];
      parts.push(
        `<text x="${lx}" y="${ly - 10}" text-anchor="middle" font-size="10.5" fill="${INK_SECONDARY}">${esc(fmt(s.values[s.values.length - 1] ?? 0))}</text>`
      );
    });
  }

  categories.forEach((cat, i) => {
    const label = cat.length > 14 ? `${cat.slice(0, 13)}…` : cat;
    parts.push(
      `<text x="${xForGroup(i)}" y="${padding.top + chartH + 18}" text-anchor="middle" font-size="11" fill="${INK_SECONDARY}">${esc(label)}</text>`
    );
  });

  if (series.length > 1) {
    let lx = padding.left;
    const ly = H - 10;
    series.forEach((s, si) => {
      parts.push(
        `<rect x="${lx}" y="${ly - 8}" width="8" height="8" rx="4" fill="${CATEGORICAL[si % CATEGORICAL.length]}"/>`,
        `<text x="${lx + 12}" y="${ly}" font-size="11.5" fill="${INK_SECONDARY}">${esc(s.name)}</text>`
      );
      lx += 12 + 8 + s.name.length * 6.5 + 16;
    });
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">${parts.join("")}</svg>`;
  return { svg, width: W, height: H };
}

function chartHtml(config: unknown): { html: string; width: number; height: number } {
  const c = storyChartSchema.parse(config);
  const { svg, width, height } = chartSvg(c);
  const inner = `<div id="block" style="width:${width + 32}px;padding:16px;background:#fff;">${svg}</div>`;
  return { html: docHtml(inner), width: width + 32, height: height + 32 };
}

async function screenshotBlock(
  html: string,
  viewport: { width: number; height: number }
): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    // Cap the image-decode wait — a stalled remote hero image must not hang the
    // whole invocation (see lib/export/screenshot.ts for the same guard).
    await Promise.race([
      page.evaluate(() =>
        Promise.all(
          Array.from(document.images)
            .filter((img) => !img.complete)
            .map((img) => img.decode().catch(() => {}))
        )
      ),
      page.waitForTimeout(5_000),
    ]).catch(() => {});
    const el = await page.$("#block");
    return (el
      ? await el.screenshot({ type: "png" })
      : await page.screenshot({ type: "png" })) as Buffer;
  } finally {
    await browser.close();
  }
}

/** Render a hero/chart directive block to a PNG buffer. Throws for other types. */
export async function renderStoryBlockImage(
  type: string,
  config: unknown
): Promise<Buffer> {
  if (type === "story:hero") {
    const { html, width, height } = heroHtml(config);
    return screenshotBlock(html, { width, height });
  }
  if (type === "story:chart") {
    const { html, width, height } = chartHtml(config);
    return screenshotBlock(html, { width: Math.max(width, 320), height: Math.max(height, 120) });
  }
  throw new Error(`renderStoryBlockImage: unsupported block type "${type}"`);
}

/**
 * Upload a rendered block PNG to the public story-assets bucket and return its
 * URL. The object path is content-addressed (a hash of type+config) so
 * re-exporting an unchanged story reuses the same URL instead of accumulating
 * duplicates.
 */
export async function uploadStoryAsset(
  storyId: string,
  type: string,
  config: unknown,
  png: Buffer
): Promise<string> {
  const admin = createAdminClient();
  const hash = createHash("sha1").update(type).update(JSON.stringify(config)).digest("hex").slice(0, 16);
  const path = `${storyId}/${type.replace(":", "-")}-${hash}.png`;
  const { error } = await admin.storage
    .from(STORY_ASSETS_BUCKET)
    .upload(path, png, { contentType: "image/png", upsert: true });
  if (error) {
    const missing = /not found|does not exist|bucket/i.test(error.message);
    throw new Error(
      missing
        ? `the "${STORY_ASSETS_BUCKET}" bucket is missing — apply migration 0015`
        : `upload failed: ${error.message}`
    );
  }
  return admin.storage.from(STORY_ASSETS_BUCKET).getPublicUrl(path).data.publicUrl;
}
