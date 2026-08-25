// Canonical header renderer — the ONE source of truth for the exported pixels.
//
// `headerDocumentHTML(config)` returns a complete, self-contained HTML document
// sized to the chosen preset. The same string is used three ways:
//   • editor preview  -> <iframe srcDoc={...}> scaled down (true WYSIWYG)
//   • export API       -> Playwright page.setContent(...) then screenshot
//   • skill CLI script -> same as above, no dev server required
//
// Because every surface renders this identical markup, the preview and the
// downloaded PNG can never disagree.
//
// The layouts share the same shell, aura, and scrim:
//   • "classic": the default vertical stack (badge top / title mid /
//     speaker+brand footer), tuned for landscape-ish canvases and anchored to
//     a 627px baseline height;
//   • a horizontal "compact" layout (title left / speaker+brand right) for
//     wide, short strips like the 1100×220 newsletter banner, where any
//     stacked layout would shrink the type into illegibility — strips always
//     use it, whatever template is selected;
//   • four multi-speaker templates ("spotlight", "lineup", "billboard",
//     "gallery") whose speaker grid recomputes card/photo sizes from the
//     roster length, so 1 → 6 speakers lay out without manual tweaks. The
//     first speaker is the lead instructor and gets the featured treatment.

import {
  type HeaderConfig,
  type HeaderSpeaker,
  auraEmbedUrl,
  defaultPanelStops,
  logoFor,
  sizeFor,
  speakersFor,
  templateFor,
  titleScaleFor,
} from "./types";
import { brandFor, type Brand } from "./brands";

import { wordmarkDataUri } from "./wordmark-uri";

function esc(s: string | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Prefix app-relative asset paths so they resolve outside the app origin. */
function asset(path: string | undefined, origin?: string): string {
  if (!path) return "";
  if (/^https?:|^data:|^file:/.test(path)) return path;
  if (path.startsWith("/") && origin) return origin.replace(/\/$/, "") + path;
  return path;
}

export type RenderOpts = {
  /** Origin used to resolve app-relative asset paths (e.g. speaker photo). */
  origin?: string;
};

/** Wide-and-short canvases get the horizontal compact layout. */
function isCompact(width: number, height: number): boolean {
  return width / height >= 3.2 && height < 360;
}

/**
 * Typographic unit for the stacked/template layouts, anchored to the 627px
 * newsletter baseline height but guarded by width: on narrow/portrait canvases
 * (square, story) a pure height anchor would inflate the type until the
 * headline swallowed the whole canvas and pushed the speaker stage out.
 */
function unitFor(width: number, height: number): number {
  return Math.min(height / 627, width / 800);
}

function speakerPhotoTag(sp: HeaderSpeaker, origin?: string): string {
  return sp.photo
    ? `<img class="sp-photo" src="${esc(asset(sp.photo, origin))}" alt="" crossorigin="anonymous" />`
    : "";
}

/** First letters of the first two words — the no-photo fallback monogram. */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Portrait for the multi-speaker templates: the photo when there is one, else
 * an initials tile (same box, so the grid never collapses). Sizing comes from
 * the template's CSS for `cls`.
 */
function portraitHtml(sp: HeaderSpeaker, cls: string, origin?: string): string {
  return sp.photo
    ? `<img class="${cls}" src="${esc(asset(sp.photo, origin))}" alt="" crossorigin="anonymous" />`
    : `<div class="${cls} monogram"><span>${esc(initialsOf(sp.name))}</span></div>`;
}

/** Card tag label: explicit tag, else Host for the lead / Speaker otherwise. */
function tagFor(sp: HeaderSpeaker, isLead: boolean): string {
  return sp.tag?.trim() || (isLead ? "Host" : "Speaker");
}

/** #RGB / #RRGGBB → rgba() string with the given alpha. */
function rgba(hex: string, alpha: number): string {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(n)) return hex;
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${+a.toFixed(3)})`;
}

/** The panel-backdrop gradient from photoFx (type / angle / stops). */
function panelGradient(fx: NonNullable<HeaderConfig["photoFx"]>, accent: string): string {
  const stops = fx.stops?.length ? fx.stops : defaultPanelStops(accent);
  const list = stops
    .map((s) => `${rgba(s.color, s.alpha ?? 1)} ${Math.round(s.at)}%`)
    .join(", ");
  return fx.gradientType === "radial"
    ? `radial-gradient(circle at 50% 30%, ${list})`
    : `linear-gradient(${fx.gradientAngle ?? 180}deg, ${list})`;
}

/** Selector groups a layout hands to photoFxCss. */
type PhotoFxSelectors = {
  /** The portrait surfaces (img or monogram div) — bw filter + panel bg. */
  photos: string;
  /** The framed boxes carrying border-radius/border (often = photos). */
  frames: string;
  /** Higher-specificity lead-frame selectors whose accent border must also
   *  yield to explicit border overrides. */
  leadFrames?: string;
};

/**
 * CSS for the configured photo treatment. `bw` desaturates the photos;
 * `panel` paints the configured gradient behind each portrait (invisible
 * under full-bleed photos, a branded backdrop under transparent cutouts —
 * monogram tiles keep their own background); `radius` / `border` /
 * `borderColor` override the frames. Appended after each layout's own rules,
 * so equal-specificity overrides win by order.
 */
function photoFxCss(config: HeaderConfig, px: (n: number) => number, sel: PhotoFxSelectors): string {
  const fx = config.photoFx;
  if (!fx) return "";
  const photos = sel.photos.split(",").map((s) => s.trim());
  const frames = [
    ...sel.frames.split(","),
    ...(sel.leadFrames ? sel.leadFrames.split(",") : []),
  ].map((s) => s.trim());
  const parts: string[] = [];
  if (fx.bw) {
    parts.push(`  ${photos.map((s) => `img${s}`).join(", ")} { filter: grayscale(1) contrast(1.04); }`);
  }
  if (fx.panel) {
    const nonMono = photos.map((s) => `${s}:not(.monogram)`).join(", ");
    parts.push(`  ${nonMono} { background: ${panelGradient(fx, config.theme.accent)}; }`);
  }
  if (typeof fx.radius === "number" && Number.isFinite(fx.radius)) {
    parts.push(`  ${frames.join(", ")} { border-radius: ${px(Math.max(0, fx.radius))}px; }`);
  }
  if (fx.border === false) {
    parts.push(`  ${frames.join(", ")} { border-color: transparent; }`);
  } else if (fx.borderColor?.trim()) {
    parts.push(`  ${frames.join(", ")} { border-color: ${fx.borderColor.trim()}; }`);
  }
  return parts.length ? `\n${parts.join("\n")}` : "";
}

/** Head + body shell shared by both layouts: reset, aura iframe, scrim. */
function documentShell(args: {
  width: number;
  height: number;
  scrimCss: string;
  modeCss: string;
  auraSrc: string;
  textColor: string;
  bodyHtml: string;
}): string {
  const { width, height, scrimCss, modeCss, auraSrc, textColor, bodyHtml } = args;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=${width}, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${width}px; height: ${height}px; }
  body {
    font-family: "Inter", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    background: #014A50;
    color: ${textColor};
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  #header {
    position: relative;
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    isolation: isolate;
  }
  /* Real animated aura background, full-bleed. */
  .aura {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    border: 0; z-index: 0;
    pointer-events: none;
  }
  /* Legibility scrim — darker on the left where the copy sits, like the ref. */
  .scrim {
    position: absolute; inset: 0; z-index: 1;
    background: ${scrimCss};
  }
  .content { position: relative; z-index: 2; width: 100%; height: 100%; }
${modeCss}
</style>
</head>
<body>
  <div id="header">
    <iframe class="aura" title="" aria-hidden="true" tabindex="-1"
            src="${auraSrc}"></iframe>
    <div class="scrim"></div>
    ${bodyHtml}
  </div>
  <script>
    // Headline auto-fit. The speaker stage never flex-shrinks, so an oversized
    // headline (long copy, big titleScale, small canvas) overflows the .mid
    // block instead of eating the photos — this shrinks the title/subtitle
    // together until everything fits (down to 45% of the starting size).
    // Runs identically in the editor preview iframe and the export screenshot
    // (the screenshot's settle delay leaves it ample time to converge).
    (function () {
      var content = document.querySelector("#header .content");
      if (!content) return;
      var mid = content.querySelector(".mid");
      var els = [].slice.call(content.querySelectorAll(".title, .subtitle"));
      if (!els.length) return;
      var base = els.map(function (el) {
        return parseFloat(getComputedStyle(el).fontSize);
      });
      function overflowing() {
        return (
          content.scrollHeight > content.clientHeight + 1 ||
          (mid && mid.scrollHeight > mid.clientHeight + 1)
        );
      }
      function fit() {
        var k = 1;
        while (overflowing() && k > 0.45) {
          k -= 0.05;
          for (var i = 0; i < els.length; i++) {
            els[i].style.fontSize = base[i] * k + "px";
          }
        }
      }
      fit();
      // Refit once webfonts land (metrics change can re-trigger overflow).
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(fit).catch(function () {});
      }
    })();
  </script>
</body>
</html>`;
}

export function headerDocumentHTML(config: HeaderConfig, opts: RenderOpts = {}): string {
  const size = sizeFor(config.sizeId);
  const { width, height } = size;
  const t = config.theme;
  const auraSrc = esc(auraEmbedUrl(config.auraSlug));

  const template = templateFor(config);

  // Shared scrim. The centered templates get a symmetric top+bottom fade (a
  // left-biased scrim would lopside their speaker grid); everything else keeps
  // the classic darker bottom-left where the copy sits.
  const centered = template === "spotlight";
  const scrimCss = centered
    ? `
      linear-gradient(180deg, rgba(2,18,18,${t.scrim * 0.7}) 0%, rgba(2,18,18,${t.scrim * 0.3}) 38%, rgba(2,18,18,${Math.min(0.85, t.scrim + 0.2)}) 100%)`
    : `
      linear-gradient(90deg, rgba(2,18,18,${t.scrim}) 0%, rgba(2,18,18,${t.scrim * 0.5}) 42%, rgba(2,18,18,0) 78%),
      linear-gradient(0deg, rgba(2,18,18,${Math.min(0.85, t.scrim + 0.2)}) 0%, rgba(2,18,18,0) 46%)`;

  // Strips are too short for any stacked/grid layout — always compact.
  if (isCompact(width, height)) {
    return compactDocument(config, size, scrimCss, auraSrc, opts);
  }
  switch (template) {
    case "spotlight":
      return spotlightDocument(config, size, scrimCss, auraSrc, opts);
    case "lineup":
      return lineupDocument(config, size, scrimCss, auraSrc, opts);
    case "billboard":
      return billboardDocument(config, size, scrimCss, auraSrc, opts);
    case "gallery":
      return galleryDocument(config, size, scrimCss, auraSrc, opts);
    default:
      return stackedDocument(config, size, scrimCss, auraSrc, opts);
  }
}

/** Default vertical stack — tuned for landscape-ish canvases (627px baseline). */
function stackedDocument(
  config: HeaderConfig,
  size: { width: number; height: number },
  scrimCss: string,
  auraSrc: string,
  opts: RenderOpts,
): string {
  const { width, height } = size;
  const t = config.theme;
  // Typographic scale anchored to the newsletter baseline (width-guarded).
  const u = unitFor(width, height);
  const pad = Math.round(56 * u);
  const titlePx = Math.round((config.title.length > 90 ? 40 : 48) * u * titleScaleFor(config));
  const photoPx = Math.round(72 * u);
  const logoPx = Math.round(40 * u * logoFor(config).scale);

  const chips = chipsHtml(config);

  // Classic shows the lead; extra roster entries surface as a "+N" hint.
  const roster = speakersFor(config);
  const sp = roster[0];
  const extras = roster.length - 1;
  const speaker = sp
    ? `
      <div class="speaker">
        ${speakerPhotoTag(sp, opts.origin)}
        <div class="sp-meta">
          <div class="sp-with">With</div>
          <div class="sp-name">${esc(sp.name)}${extras > 0 ? ` <span style="font-weight:600;opacity:.75">+${extras} more</span>` : ""}</div>
          ${sp.role ? `<div class="sp-role">${esc(sp.role)}</div>` : ""}
          ${sp.org ? `<div class="sp-org">${esc(sp.org)}</div>` : ""}
        </div>
      </div>`
    : "";

  const brand = brandHtml(config);
  const badge = badgeHtml(config);

  const modeCss = `
  .content {
    padding: ${pad}px;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .badge {
    display: inline-flex; align-items: center; gap: ${Math.round(8 * u)}px;
    align-self: flex-start;
    padding: ${Math.round(7 * u)}px ${Math.round(15 * u)}px;
    border-radius: 999px;
    background: rgba(255,255,255,0.14);
    border: 1px solid rgba(255,255,255,0.28);
    backdrop-filter: blur(8px);
    font-size: ${Math.round(13 * u)}px; font-weight: 700;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: #fff;
  }
  .badge-dot {
    width: ${Math.round(7 * u)}px; height: ${Math.round(7 * u)}px;
    border-radius: 999px; background: ${t.accent};
    box-shadow: 0 0 ${Math.round(10 * u)}px ${t.accent};
  }
  .title {
    max-width: ${Math.round(width * 0.74)}px;
    font-size: ${titlePx}px; font-weight: 800; line-height: 1.08;
    letter-spacing: -0.015em;
    text-shadow: 0 2px 18px rgba(0,0,0,0.35);
  }
  .chips { display: flex; flex-wrap: wrap; gap: ${Math.round(10 * u)}px; margin-top: ${Math.round(20 * u)}px; }
  /* Optional frosted card behind the headline block (display:contents = no-op when off). */
  .textcard { display: contents; }
  .textcard.on {
    display: block; align-self: flex-start;
    width: fit-content; max-width: 100%;
    padding: ${Math.round(30 * u)}px ${Math.round(34 * u)}px;
    border-radius: ${Math.round(22 * u)}px;
    background: rgba(2,18,18,0.45);
    border: 1px solid rgba(255,255,255,0.16);
    backdrop-filter: blur(${Math.round(12 * u)}px);
    box-shadow: 0 ${Math.round(24 * u)}px ${Math.round(70 * u)}px rgba(0,0,0,0.38);
  }
  .chip {
    display: inline-flex; align-items: center; gap: ${Math.round(7 * u)}px;
    padding: ${Math.round(7 * u)}px ${Math.round(13 * u)}px;
    border-radius: 999px;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.22);
    backdrop-filter: blur(6px);
    font-size: ${Math.round(14 * u)}px; font-weight: 600; color: #fff;
  }
  .chip-ic { font-size: ${Math.round(14 * u)}px; line-height: 1; }
  .mid { display: flex; flex-direction: column; justify-content: center; flex: 1; min-height: 0; overflow: hidden; padding: ${Math.round(28 * u)}px 0; }
  .footer { display: flex; align-items: flex-end; justify-content: space-between; gap: ${Math.round(20 * u)}px; flex-shrink: 0; }
  .speaker { display: flex; align-items: center; gap: ${Math.round(14 * u)}px; }
  .sp-photo {
    width: ${photoPx}px; height: ${photoPx}px;
    border-radius: ${Math.round(14 * u)}px; object-fit: cover;
    border: 2px solid rgba(255,255,255,0.5);
    box-shadow: 0 ${Math.round(8 * u)}px ${Math.round(24 * u)}px rgba(0,0,0,0.35);
  }
  .sp-with { font-size: ${Math.round(11 * u)}px; font-weight: 600; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.12em; }
  .sp-name { font-size: ${Math.round(20 * u)}px; font-weight: 700; line-height: 1.15; }
  .sp-role { font-size: ${Math.round(13 * u)}px; opacity: 0.85; }
  .sp-org { font-size: ${Math.round(13 * u)}px; font-weight: 700; }
  .brand { text-align: right; }
  .brand-logo { display: inline-block; vertical-align: bottom; height: ${logoPx}px; width: auto; }  .brand-sub {
    font-size: ${Math.round(10 * u)}px; font-weight: 600; opacity: 0.75;
    text-transform: uppercase; letter-spacing: 0.16em; margin-top: ${Math.round(6 * u)}px;
  }${photoFxCss(config, (n) => Math.round(n * u), { photos: ".sp-photo", frames: ".sp-photo" })}`;

  const bodyHtml = `<div class="content">
      <div>${badge}</div>
      <div class="mid">
        <div class="textcard${t.card ? " on" : ""}">
          <h1 class="title">${esc(config.title)}</h1>
          ${config.subtitle?.trim() ? `<p class="title" style="font-size:${Math.round(20 * u)}px;font-weight:500;opacity:.9;margin-top:${Math.round(14 * u)}px">${esc(config.subtitle)}</p>` : ""}
          ${chips ? `<div class="chips">${chips}</div>` : ""}
        </div>
      </div>
      <div class="footer">
        ${speaker || "<span></span>"}
        ${brand || "<span></span>"}
      </div>
    </div>`;

  return documentShell({
    width,
    height,
    scrimCss,
    modeCss,
    auraSrc,
    textColor: t.text,
    bodyHtml,
  });
}

/** Horizontal compact layout for wide, short strips (e.g. 1100×220). */
function compactDocument(
  config: HeaderConfig,
  size: { width: number; height: number },
  scrimCss: string,
  auraSrc: string,
  opts: RenderOpts,
): string {
  const { width, height } = size;
  const t = config.theme;
  // Anchored to the 220px strip baseline so type stays legible at this height.
  const u = height / 220;
  const px = (n: number) => Math.round(n * u);
  const len = config.title.length;
  const titlePx = Math.round(px(len > 64 ? 24 : len > 40 ? 28 : 33) * titleScaleFor(config));
  const photoPx = px(52);
  const logoPx = Math.round(30 * u * logoFor(config).scale);

  const chips = chipsHtml(config);
  const badge = badgeHtml(config);
  const brand = brandHtml(config);

  // Compact speaker: photo on the right edge, name + role·org to its left.
  // Strips only fit one card, so show the lead and a "+N" hint for the rest.
  const roster = speakersFor(config);
  const sp = roster[0];
  const extras = roster.length - 1;
  const speaker = sp
    ? `
      <div class="speaker">
        ${speakerPhotoTag(sp, opts.origin)}
        <div class="sp-meta">
          <div class="sp-name">${esc(sp.name)}${extras > 0 ? ` <span style="font-weight:600;opacity:.75">+${extras}</span>` : ""}</div>
          ${
            sp.role || sp.org
              ? `<div class="sp-role">${esc([sp.role, sp.org].filter(Boolean).join(" · "))}</div>`
              : ""
          }
        </div>
      </div>`
    : "";

  const modeCss = `
  .content {
    display: flex; flex-direction: row; align-items: center; justify-content: space-between;
    gap: ${px(28)}px; padding: ${px(24)}px ${px(42)}px;
  }
  .c-left { display: flex; flex-direction: column; align-items: flex-start; gap: ${px(9)}px; max-width: ${Math.round(width * 0.64)}px; }
  /* Optional frosted card behind the headline block. */
  .c-left.on {
    padding: ${px(18)}px ${px(22)}px;
    border-radius: ${px(18)}px;
    background: rgba(2,18,18,0.45);
    border: 1px solid rgba(255,255,255,0.16);
    backdrop-filter: blur(${px(10)}px);
    box-shadow: 0 ${px(14)}px ${px(40)}px rgba(0,0,0,0.35);
  }
  .c-right { display: flex; flex-direction: column; align-items: flex-end; gap: ${px(10)}px; text-align: right; flex-shrink: 0; }
  .badge {
    display: inline-flex; align-items: center; gap: ${px(7)}px;
    padding: ${px(5)}px ${px(12)}px;
    border-radius: 999px;
    background: rgba(255,255,255,0.14);
    border: 1px solid rgba(255,255,255,0.28);
    backdrop-filter: blur(8px);
    font-size: ${px(12)}px; font-weight: 700;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: #fff;
  }
  .badge-dot {
    width: ${px(6)}px; height: ${px(6)}px;
    border-radius: 999px; background: ${t.accent};
    box-shadow: 0 0 ${px(9)}px ${t.accent};
  }
  .title {
    font-size: ${titlePx}px; font-weight: 800; line-height: 1.06;
    letter-spacing: -0.015em;
    text-shadow: 0 2px 18px rgba(0,0,0,0.35);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .chips { display: flex; flex-wrap: wrap; gap: ${px(8)}px; }
  .chip {
    display: inline-flex; align-items: center; gap: ${px(6)}px;
    padding: ${px(5)}px ${px(11)}px;
    border-radius: 999px;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.22);
    backdrop-filter: blur(6px);
    font-size: ${px(12)}px; font-weight: 600; color: #fff; white-space: nowrap;
  }
  .chip-ic { font-size: ${px(12)}px; line-height: 1; }
  .speaker { display: flex; flex-direction: row-reverse; align-items: center; gap: ${px(11)}px; }
  .sp-photo {
    width: ${photoPx}px; height: ${photoPx}px;
    border-radius: ${px(12)}px; object-fit: cover;
    border: 2px solid rgba(255,255,255,0.5);
    box-shadow: 0 ${px(6)}px ${px(18)}px rgba(0,0,0,0.35);
  }
  .sp-meta { text-align: right; }
  .sp-name { font-size: ${px(16)}px; font-weight: 700; line-height: 1.15; }
  .sp-role { font-size: ${px(11)}px; opacity: 0.85; }
  .brand { text-align: right; }
  .brand-logo { display: inline-block; vertical-align: bottom; height: ${logoPx}px; width: auto; }  .brand-sub {
    font-size: ${px(9)}px; font-weight: 600; opacity: 0.75;
    text-transform: uppercase; letter-spacing: 0.16em; margin-top: ${px(4)}px;
  }${photoFxCss(config, px, { photos: ".sp-photo", frames: ".sp-photo" })}`;

  const hasRight = !!(speaker || brand);
  const bodyHtml = `<div class="content">
      <div class="c-left${t.card ? " on" : ""}">
        ${badge}
        <h1 class="title">${esc(config.title)}</h1>
        ${chips ? `<div class="chips">${chips}</div>` : ""}
      </div>
      ${hasRight ? `<div class="c-right">${speaker}${brand}</div>` : ""}
    </div>`;

  return documentShell({
    width,
    height,
    scrimCss,
    modeCss,
    auraSrc,
    textColor: t.text,
    bodyHtml,
  });
}

/* ---- multi-speaker templates -------------------------------------------
   All four share the same skeleton: a top bar (badge left / brand right), a
   headline block, and a speaker "stage" pinned to the bottom whose card and
   photo sizes are recomputed from the roster length so the grid adapts from
   one speaker to six without manual tweaks. Index 0 is the lead instructor. */

/** CSS shared by the template layouts (badge, chips, brand, monogram, title). */
function templateBaseCss(
  px: (n: number) => number,
  accent: string,
  logoPx: number,
  pad: number
): string {
  return `
  .content { padding: ${pad}px; display: flex; flex-direction: column; }
  .topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: ${px(20)}px; }
  .badge {
    display: inline-flex; align-items: center; gap: ${px(8)}px;
    padding: ${px(7)}px ${px(15)}px;
    border-radius: 999px;
    background: rgba(255,255,255,0.14);
    border: 1px solid rgba(255,255,255,0.28);
    backdrop-filter: blur(8px);
    font-size: ${px(13)}px; font-weight: 700;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: #fff;
  }
  .badge-dot {
    width: ${px(7)}px; height: ${px(7)}px;
    border-radius: 999px; background: ${accent};
    box-shadow: 0 0 ${px(10)}px ${accent};
  }
  .chips { display: flex; flex-wrap: wrap; gap: ${px(10)}px; }
  .chip {
    display: inline-flex; align-items: center; gap: ${px(7)}px;
    padding: ${px(7)}px ${px(13)}px;
    border-radius: 999px;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.22);
    backdrop-filter: blur(6px);
    font-size: ${px(14)}px; font-weight: 600; color: #fff;
  }
  .chip-ic { font-size: ${px(14)}px; line-height: 1; }
  .brand { text-align: right; }
  .brand-logo { display: inline-block; vertical-align: bottom; height: ${logoPx}px; width: auto; }
  .brand-sub {
    font-size: ${px(10)}px; font-weight: 600; opacity: 0.75;
    text-transform: uppercase; letter-spacing: 0.16em; margin-top: ${px(6)}px;
  }
  .title {
    font-weight: 800; line-height: 1.08; letter-spacing: -0.015em;
    text-shadow: 0 2px 18px rgba(0,0,0,0.35);
  }
  .subtitle { font-weight: 500; opacity: 0.9; }
  .monogram {
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08));
    color: #fff; font-weight: 800; letter-spacing: 0.04em;
  }`;
}

function topbarHtml(config: HeaderConfig): string {
  const badge = badgeHtml(config);
  const brand = brandHtml(config);
  return `<div class="topbar">${badge || "<span></span>"}${brand || "<span></span>"}</div>`;
}

/**
 * Spotlight — the lead instructor's portrait dead-center on the bottom stage,
 * supporting speakers fanning outward left/right (added alternately, so the
 * composition stays balanced at any count). Centered headline.
 */
function spotlightDocument(
  config: HeaderConfig,
  size: { width: number; height: number },
  scrimCss: string,
  auraSrc: string,
  opts: RenderOpts,
): string {
  const { width, height } = size;
  const t = config.theme;
  const u = unitFor(width, height);
  const px = (n: number) => Math.round(n * u);
  const pad = px(46);
  const titlePx = Math.round(px(config.title.length > 90 ? 30 : 38) * titleScaleFor(config));
  const logoPx = Math.round(34 * u * logoFor(config).scale);

  const roster = speakersFor(config);
  const n = roster.length;

  // Photos target half the canvas height (tag + name + role text under them
  // included), then every card shrinks by one shared factor if the row would
  // overflow the width — so the grid adapts to both the size preset and the
  // roster length.
  const gap = px(18);
  const textBlock = px(74);
  const leadH0 = Math.max(px(120), Math.round(height * 0.5) - textBlock);
  const supH0 = Math.round(leadH0 * 0.82);
  const leadW0 = Math.round(leadH0 / 1.24);
  const supW0 = Math.round(supH0 / 1.24);
  const natural = n ? leadW0 + (n - 1) * supW0 + (n - 1) * gap : 0;
  const fit = n ? Math.min(1, (width - 2 * pad) / natural) : 1;
  const leadW = Math.round(leadW0 * fit);
  const supW = Math.round(supW0 * fit);
  const leadH = Math.round(leadH0 * fit);
  const supH = Math.round(supH0 * fit);

  // Center-out order: lead in the middle, then alternate right / left.
  const leftSide: HeaderSpeaker[] = [];
  const rightSide: HeaderSpeaker[] = [];
  roster.slice(1).forEach((s, i) => (i % 2 === 0 ? rightSide : leftSide).push(s));
  leftSide.reverse();
  const ordered = [
    ...leftSide.map((s) => ({ s, lead: false })),
    ...(roster[0] ? [{ s: roster[0], lead: true }] : []),
    ...rightSide.map((s) => ({ s, lead: false })),
  ];

  const cells = ordered
    .map(
      ({ s, lead }) => `
      <div class="cell${lead ? " lead" : ""}">
        ${portraitHtml(s, lead ? "ph-lead" : "ph-sup", opts.origin)}
        <div class="cell-tag">${esc(tagFor(s, lead))}</div>
        <div class="cell-name">${esc(s.name)}</div>
        ${s.role ? `<div class="cell-role">${esc(s.role)}</div>` : ""}
        ${s.org ? `<div class="cell-org">${esc(s.org)}</div>` : ""}
      </div>`
    )
    .join("");

  const chips = chipsHtml(config);

  const modeCss = `${templateBaseCss(px, t.accent, logoPx, pad)}
  .mid { display: flex; flex-direction: column; align-items: center; text-align: center; margin-top: ${px(16)}px; min-height: 0; overflow: hidden; }
  .title { max-width: ${Math.round(width * 0.84)}px; font-size: ${titlePx}px; }
  .subtitle { max-width: ${Math.round(width * 0.7)}px; font-size: ${px(17)}px; margin-top: ${px(10)}px; }
  .chips { justify-content: center; margin-top: ${px(16)}px; }
  .stage { display: flex; align-items: flex-end; justify-content: center; gap: ${gap}px; margin-top: auto; padding-top: ${px(20)}px; flex-shrink: 0; }
  .cell { display: flex; flex-direction: column; align-items: center; text-align: center; width: ${supW}px; }
  .cell.lead { width: ${leadW}px; }
  .ph-lead {
    width: ${leadW}px; height: ${leadH}px;
    border-radius: ${px(18)}px; object-fit: cover;
    border: 2px solid ${t.accent};
    box-shadow: 0 ${px(14)}px ${px(40)}px rgba(0,0,0,0.45);
  }
  .ph-sup {
    width: ${supW}px; height: ${supH}px;
    border-radius: ${px(16)}px; object-fit: cover;
    border: 2px solid rgba(255,255,255,0.35);
    box-shadow: 0 ${px(10)}px ${px(28)}px rgba(0,0,0,0.35);
  }
  .monogram { font-size: ${px(34)}px; }
  .cell.lead .monogram { font-size: ${px(44)}px; }
  .cell-tag {
    font-size: ${px(10)}px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.14em; opacity: 0.75; margin-top: ${px(10)}px;
  }
  .cell.lead .cell-tag { color: ${t.accent}; opacity: 1; }
  .cell-name { font-size: ${px(15)}px; font-weight: 700; line-height: 1.15; margin-top: ${px(3)}px; }
  .cell.lead .cell-name { font-size: ${px(19)}px; }
  .cell-role { font-size: ${px(12)}px; opacity: 0.85; margin-top: ${px(3)}px; }
  .cell-org { font-size: ${px(12)}px; font-weight: 700; margin-top: ${px(2)}px; }${photoFxCss(config, px, { photos: ".ph-lead, .ph-sup", frames: ".ph-lead, .ph-sup" })}`;

  const bodyHtml = `<div class="content">
      ${topbarHtml(config)}
      <div class="mid">
        <h1 class="title">${esc(config.title)}</h1>
        ${config.subtitle?.trim() ? `<p class="subtitle">${esc(config.subtitle)}</p>` : ""}
        ${chips ? `<div class="chips">${chips}</div>` : ""}
      </div>
      ${cells ? `<div class="stage">${cells}</div>` : ""}
    </div>`;

  return documentShell({ width, height, scrimCss, modeCss, auraSrc, textColor: t.text, bodyHtml });
}

/**
 * Lineup — conference-style vertical panels (tag / name / role / portrait) in
 * an equal-width row. Flexbox splits the row evenly, so the columns narrow as
 * speakers are added; the lead panel is accent-framed.
 */
function lineupDocument(
  config: HeaderConfig,
  size: { width: number; height: number },
  scrimCss: string,
  auraSrc: string,
  opts: RenderOpts,
): string {
  const { width, height } = size;
  const t = config.theme;
  const u = unitFor(width, height);
  const px = (n: number) => Math.round(n * u);
  const pad = px(44);
  const titlePx = Math.round(px(config.title.length > 90 ? 28 : 34) * titleScaleFor(config));
  const logoPx = Math.round(34 * u * logoFor(config).scale);
  const roster = speakersFor(config);
  const chips = chipsHtml(config);

  const cols = roster
    .map(
      (s, i) => `
      <div class="col${i === 0 ? " lead" : ""}">
        <div class="col-tag">${esc(tagFor(s, i === 0))}</div>
        <div class="col-name">${esc(s.name)}</div>
        ${s.role ? `<div class="col-role">${esc(s.role)}</div>` : ""}
        ${s.org ? `<div class="col-org">${esc(s.org)}</div>` : ""}
        ${portraitHtml(s, "col-photo", opts.origin)}
      </div>`
    )
    .join("");

  const modeCss = `${templateBaseCss(px, t.accent, logoPx, pad)}
  .mid { margin-top: ${px(16)}px; min-height: 0; overflow: hidden; }
  .title { max-width: ${Math.round(width * 0.9)}px; font-size: ${titlePx}px; }
  .subtitle { max-width: ${Math.round(width * 0.75)}px; font-size: ${px(16)}px; margin-top: ${px(8)}px; }
  .chips { margin-top: ${px(14)}px; }
  .stage {
    display: flex; justify-content: center; gap: ${px(14)}px;
    margin-top: auto; padding-top: ${px(20)}px; flex-shrink: 0;
    height: ${Math.round(height * 0.5)}px;
  }
  .col {
    flex: 1 1 0; max-width: ${px(250)}px; min-width: 0;
    display: flex; flex-direction: column;
    padding: ${px(14)}px;
    border-radius: ${px(16)}px;
    background: rgba(2,18,18,0.35);
    border: 1px solid rgba(255,255,255,0.18);
    backdrop-filter: blur(8px);
  }
  .col.lead { border-color: ${t.accent}; background: rgba(2,18,18,0.45); }
  .col-tag {
    font-size: ${px(10)}px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.14em; opacity: 0.8;
  }
  .col.lead .col-tag { color: ${t.accent}; opacity: 1; }
  .col-name {
    font-size: ${px(17)}px; font-weight: 800; line-height: 1.12; margin-top: ${px(6)}px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .col-role {
    font-size: ${px(11)}px; opacity: 0.85; margin-top: ${px(3)}px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .col-org { font-size: ${px(11)}px; font-weight: 700; margin-top: ${px(2)}px; }
  .col-photo {
    flex: 1; min-height: 0; width: 100%; margin-top: ${px(10)}px;
    border-radius: ${px(10)}px; object-fit: cover;
  }
  .monogram { font-size: ${px(30)}px; }${photoFxCss(config, px, { photos: ".col-photo", frames: ".col, .col-photo", leadFrames: ".col.lead" })}`;

  const bodyHtml = `<div class="content">
      ${topbarHtml(config)}
      <div class="mid">
        <h1 class="title">${esc(config.title)}</h1>
        ${config.subtitle?.trim() ? `<p class="subtitle">${esc(config.subtitle)}</p>` : ""}
        ${chips ? `<div class="chips">${chips}</div>` : ""}
      </div>
      ${cols ? `<div class="stage">${cols}</div>` : ""}
    </div>`;

  return documentShell({ width, height, scrimCss, modeCss, auraSrc, textColor: t.text, bodyHtml });
}

/**
 * Billboard — big headline top-left, bottom-aligned speaker row on the right
 * with the lead first and slightly larger. Photo widths shrink together once
 * the roster would overflow the row.
 */
function billboardDocument(
  config: HeaderConfig,
  size: { width: number; height: number },
  scrimCss: string,
  auraSrc: string,
  opts: RenderOpts,
): string {
  const { width, height } = size;
  const t = config.theme;
  const u = unitFor(width, height);
  const px = (n: number) => Math.round(n * u);
  const pad = px(48);
  const titlePx = Math.round(px(config.title.length > 90 ? 36 : 44) * titleScaleFor(config));
  const logoPx = Math.round(34 * u * logoFor(config).scale);
  const roster = speakersFor(config);
  const n = roster.length;
  const chips = chipsHtml(config);

  // Photos target half the canvas height (tag + name + role text included),
  // then shrink by one shared factor if the row would overflow the width.
  const gap = px(20);
  const textBlock = px(78);
  const leadH0 = Math.max(px(110), Math.round(height * 0.5) - textBlock);
  const supH0 = Math.round(leadH0 * 0.84);
  const leadW0 = Math.round(leadH0 / 1.1);
  const supW0 = Math.round(supH0 / 1.1);
  const natural = n ? leadW0 + (n - 1) * supW0 + (n - 1) * gap : 0;
  const fit = n ? Math.min(1, (width - 2 * pad) / natural) : 1;
  const leadW = Math.round(leadW0 * fit);
  const supW = Math.round(supW0 * fit);
  const leadH = Math.round(leadH0 * fit);
  const supH = Math.round(supH0 * fit);

  const cells = roster
    .map(
      (s, i) => `
      <div class="cell${i === 0 ? " lead" : ""}">
        ${portraitHtml(s, "ph", opts.origin)}
        <div class="cell-tag">${esc(tagFor(s, i === 0))}</div>
        <div class="cell-name">${esc(s.name)}</div>
        ${s.role ? `<div class="cell-role">${esc(s.role)}</div>` : ""}
        ${s.org ? `<div class="cell-org">${esc(s.org)}</div>` : ""}
      </div>`
    )
    .join("");

  const modeCss = `${templateBaseCss(px, t.accent, logoPx, pad)}
  .mid { margin-top: ${px(18)}px; min-height: 0; overflow: hidden; }
  .title { max-width: ${Math.round(width * 0.68)}px; font-size: ${titlePx}px; }
  .subtitle { max-width: ${Math.round(width * 0.6)}px; font-size: ${px(17)}px; margin-top: ${px(10)}px; }
  .chips { margin-top: ${px(16)}px; }
  .stage { display: flex; align-items: flex-end; justify-content: flex-end; gap: ${gap}px; margin-top: auto; padding-top: ${px(20)}px; flex-shrink: 0; }
  .cell { display: flex; flex-direction: column; align-items: flex-start; width: ${supW}px; }
  .cell.lead { width: ${leadW}px; }
  .ph {
    width: 100%; height: ${supH}px;
    border-radius: ${px(14)}px; object-fit: cover;
    border: 2px solid rgba(255,255,255,0.35);
    box-shadow: 0 ${px(10)}px ${px(28)}px rgba(0,0,0,0.35);
  }
  .cell.lead .ph { height: ${leadH}px; border-color: ${t.accent}; }
  .monogram { font-size: ${px(30)}px; }
  .cell-tag {
    font-size: ${px(10)}px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.14em; opacity: 0.75; margin-top: ${px(8)}px;
  }
  .cell.lead .cell-tag { color: ${t.accent}; opacity: 1; }
  .cell-name {
    font-size: ${px(14)}px; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.02em; line-height: 1.15; margin-top: ${px(3)}px;
  }
  .cell-role { font-size: ${px(11)}px; opacity: 0.85; margin-top: ${px(3)}px; }
  .cell-org {
    font-size: ${px(11)}px; font-weight: 700; color: ${t.accent};
    text-transform: uppercase; letter-spacing: 0.08em; margin-top: ${px(2)}px;
  }${photoFxCss(config, px, { photos: ".ph", frames: ".ph", leadFrames: ".cell.lead .ph" })}`;

  const bodyHtml = `<div class="content">
      ${topbarHtml(config)}
      <div class="mid">
        <h1 class="title">${esc(config.title)}</h1>
        ${config.subtitle?.trim() ? `<p class="subtitle">${esc(config.subtitle)}</p>` : ""}
        ${chips ? `<div class="chips">${chips}</div>` : ""}
      </div>
      ${cells ? `<div class="stage">${cells}</div>` : ""}
    </div>`;

  return documentShell({ width, height, scrimCss, modeCss, auraSrc, textColor: t.text, bodyHtml });
}

/**
 * Gallery — large rounded full-bleed portrait cards side by side, each with a
 * bottom gradient name plate. Flexbox shares the row, so cards narrow as the
 * roster grows; the lead card is accent-framed with an accent tag pill.
 */
function galleryDocument(
  config: HeaderConfig,
  size: { width: number; height: number },
  scrimCss: string,
  auraSrc: string,
  opts: RenderOpts,
): string {
  const { width, height } = size;
  const t = config.theme;
  const u = unitFor(width, height);
  const px = (n: number) => Math.round(n * u);
  const pad = px(46);
  const titlePx = Math.round(px(config.title.length > 90 ? 30 : 38) * titleScaleFor(config));
  const logoPx = Math.round(34 * u * logoFor(config).scale);
  const roster = speakersFor(config);
  const chips = chipsHtml(config);

  const cards = roster
    .map(
      (s, i) => `
      <div class="card${i === 0 ? " lead" : ""}">
        ${portraitHtml(s, "card-photo", opts.origin)}
        <div class="card-shade"></div>
        <div class="card-meta">
          <span class="card-tag">${esc(tagFor(s, i === 0))}</span>
          <div class="card-name">${esc(s.name)}</div>
          ${
            s.role || s.org
              ? `<div class="card-role">${esc([s.role, s.org].filter(Boolean).join(" · "))}</div>`
              : ""
          }
        </div>
      </div>`
    )
    .join("");

  const modeCss = `${templateBaseCss(px, t.accent, logoPx, pad)}
  .mid { margin-top: ${px(16)}px; min-height: 0; overflow: hidden; }
  .title { max-width: ${Math.round(width * 0.85)}px; font-size: ${titlePx}px; }
  .subtitle { max-width: ${Math.round(width * 0.7)}px; font-size: ${px(16)}px; margin-top: ${px(8)}px; }
  .chips { margin-top: ${px(14)}px; }
  .stage {
    display: flex; justify-content: center; gap: ${px(16)}px;
    margin-top: auto; padding-top: ${px(20)}px; flex-shrink: 0;
    height: ${Math.round(height * 0.55)}px;
  }
  .card {
    position: relative; flex: 1 1 0; max-width: ${px(340)}px; min-width: 0;
    border-radius: ${px(22)}px; overflow: hidden;
    border: 1px solid rgba(255,255,255,0.28);
    box-shadow: 0 ${px(18)}px ${px(50)}px rgba(0,0,0,0.35);
  }
  .card.lead { border: 2px solid ${t.accent}; }
  .card-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .card-photo.monogram { font-size: ${px(40)}px; }
  .card-shade {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(0,0,0,0) 48%, rgba(0,0,0,0.78) 100%);
  }
  .card-meta { position: absolute; left: ${px(14)}px; right: ${px(14)}px; bottom: ${px(12)}px; }
  .card-tag {
    display: inline-block; padding: ${px(3)}px ${px(9)}px; border-radius: 999px;
    font-size: ${px(10)}px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.12em;
    background: rgba(255,255,255,0.18);
    border: 1px solid rgba(255,255,255,0.3);
    backdrop-filter: blur(6px);
    margin-bottom: ${px(6)}px;
  }
  .card.lead .card-tag { background: ${t.accent}; color: #04241C; border-color: transparent; }
  .card-name { font-size: ${px(16)}px; font-weight: 800; line-height: 1.15; }
  .card-role { font-size: ${px(11)}px; opacity: 0.9; margin-top: ${px(2)}px; }${photoFxCss(config, px, { photos: ".card-photo", frames: ".card", leadFrames: ".card.lead" })}`;

  const bodyHtml = `<div class="content">
      ${topbarHtml(config)}
      <div class="mid">
        <h1 class="title">${esc(config.title)}</h1>
        ${config.subtitle?.trim() ? `<p class="subtitle">${esc(config.subtitle)}</p>` : ""}
        ${chips ? `<div class="chips">${chips}</div>` : ""}
      </div>
      ${cards ? `<div class="stage">${cards}</div>` : ""}
    </div>`;

  return documentShell({ width, height, scrimCss, modeCss, auraSrc, textColor: t.text, bodyHtml });
}

/* ---- shared markup partials (CSS sizing comes from each layout) ---- */

function badgeHtml(config: HeaderConfig): string {
  return config.badge.trim()
    ? `<span class="badge"><span class="badge-dot"></span>${esc(config.badge)}</span>`
    : "";
}

function chipsHtml(config: HeaderConfig): string {
  return config.chips
    .filter((c) => c.label.trim())
    .map(
      (c) => `
        <span class="chip">
          ${c.icon ? `<span class="chip-ic">${esc(c.icon)}</span>` : ""}
          <span>${esc(c.label)}</span>
        </span>`
    )
    .join("");
}

// The brand lockup renders the selected brand's real wordmark (inlined,
// origin-free, recolored via config.logo). The brand is chosen from the catalog
// (lib/header/brands.ts) — never free text. The subline defaults to the brand's
// own, overridable per-config; an empty override string hides it.
// Color comes from config.logo; size (scale) is applied via the .brand-logo CSS.
function brandHtml(config: HeaderConfig): string {
  const brand = brandFor(config);
  const logo = logoFor(config);
  const sub = config.brandSub ?? brand.sub;
  return `
      <div class="brand">
        <img class="brand-logo" src="${wordmarkDataUri(brand, logo.color, logo.fill)}" alt="${esc(brand.name)}" />
        ${sub ? `<div class="brand-sub">${esc(sub)}</div>` : ""}
      </div>`;
}
