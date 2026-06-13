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
// Two layouts share the same shell, aura, and scrim:
//   • the default vertical stack (badge top / title mid / speaker+brand footer),
//     tuned for landscape-ish canvases and anchored to a 627px baseline height;
//   • a horizontal "compact" layout (title left / speaker+brand right) for
//     wide, short strips like the 1100×220 newsletter banner, where the stacked
//     layout would shrink the type into illegibility.

import {
  type HeaderConfig,
  type HeaderSpeaker,
  auraEmbedUrl,
  logoFor,
  sizeFor,
} from "./types";
import { brandFor, type Brand } from "./brands";

/**
 * A brand's wordmark as an origin-free data URI in the requested color + style.
 * The art ships as a hollow outline (every shape `fill="none"`, one native
 * stroke color), so:
 *   • outline -> swap the stroke color, shapes stay hollow;
 *   • fill    -> paint every shape with the color and drop the stroke.
 * We URL-encode (not base64) to stay isomorphic — no Buffer/btoa needed.
 */
function wordmarkDataUri(brand: Brand, color: string, fill: boolean): string {
  let svg = brand.wordmarkSvg;
  if (fill) {
    svg = svg
      .split('fill="none"')
      .join(`fill="${color}"`)
      .split(`stroke="${brand.nativeColor}"`)
      .join('stroke="none"');
  } else if (color !== brand.nativeColor) {
    svg = svg.split(brand.nativeColor).join(color);
  }
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

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

function speakerPhotoTag(sp: HeaderSpeaker, origin?: string): string {
  return sp.photo
    ? `<img class="sp-photo" src="${esc(asset(sp.photo, origin))}" alt="" crossorigin="anonymous" />`
    : "";
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
</body>
</html>`;
}

export function headerDocumentHTML(config: HeaderConfig, opts: RenderOpts = {}): string {
  const size = sizeFor(config.sizeId);
  const { width, height } = size;
  const t = config.theme;
  const auraSrc = esc(auraEmbedUrl(config.auraSlug));

  // Shared scrim: darker bottom-left where the copy sits.
  const scrimCss = `
      linear-gradient(90deg, rgba(2,18,18,${t.scrim}) 0%, rgba(2,18,18,${t.scrim * 0.5}) 42%, rgba(2,18,18,0) 78%),
      linear-gradient(0deg, rgba(2,18,18,${Math.min(0.85, t.scrim + 0.2)}) 0%, rgba(2,18,18,0) 46%)`;

  return isCompact(width, height)
    ? compactDocument(config, size, scrimCss, auraSrc, opts)
    : stackedDocument(config, size, scrimCss, auraSrc, opts);
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
  // Typographic scale anchored to the newsletter baseline height.
  const u = height / 627;
  const pad = Math.round(56 * u);
  const titlePx = Math.round((config.title.length > 90 ? 40 : 48) * u);
  const photoPx = Math.round(72 * u);
  const logoPx = Math.round(40 * u * logoFor(config).scale);

  const chips = chipsHtml(config);

  const sp = config.speaker;
  const speaker =
    sp && sp.enabled !== false && sp.name.trim()
      ? `
      <div class="speaker">
        ${speakerPhotoTag(sp, opts.origin)}
        <div class="sp-meta">
          <div class="sp-with">With</div>
          <div class="sp-name">${esc(sp.name)}</div>
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
  .mid { display: flex; flex-direction: column; justify-content: center; flex: 1; padding: ${Math.round(28 * u)}px 0; }
  .footer { display: flex; align-items: flex-end; justify-content: space-between; gap: ${Math.round(20 * u)}px; }
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
  }`;

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
  const titlePx = px(len > 64 ? 24 : len > 40 ? 28 : 33);
  const photoPx = px(52);
  const logoPx = Math.round(30 * u * logoFor(config).scale);

  const chips = chipsHtml(config);
  const badge = badgeHtml(config);
  const brand = brandHtml(config);

  const sp = config.speaker;
  // Compact speaker: photo on the right edge, name + role·org to its left.
  const speaker =
    sp && sp.enabled !== false && sp.name.trim()
      ? `
      <div class="speaker">
        ${speakerPhotoTag(sp, opts.origin)}
        <div class="sp-meta">
          <div class="sp-name">${esc(sp.name)}</div>
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
  }`;

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
