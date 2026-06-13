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

import {
  type HeaderConfig,
  auraEmbedUrl,
  sizeFor,
} from "./types";

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

export function headerDocumentHTML(config: HeaderConfig, opts: RenderOpts = {}): string {
  const size = sizeFor(config.sizeId);
  const { width, height } = size;
  const t = config.theme;
  // Typographic scale anchored to the newsletter baseline height.
  const u = height / 627;
  const pad = Math.round(56 * u);
  const titlePx = Math.round((config.title.length > 90 ? 40 : 48) * u);
  const photoPx = Math.round(72 * u);

  const chips = config.chips
    .filter((c) => c.label.trim())
    .map(
      (c) => `
        <span class="chip">
          ${c.icon ? `<span class="chip-ic">${esc(c.icon)}</span>` : ""}
          <span>${esc(c.label)}</span>
        </span>`
    )
    .join("");

  const sp = config.speaker;
  const speaker =
    sp && sp.name.trim()
      ? `
      <div class="speaker">
        ${
          sp.photo
            ? `<img class="sp-photo" src="${esc(asset(sp.photo, opts.origin))}" alt="" crossorigin="anonymous" />`
            : ""
        }
        <div class="sp-meta">
          <div class="sp-with">With</div>
          <div class="sp-name">${esc(sp.name)}</div>
          ${sp.role ? `<div class="sp-role">${esc(sp.role)}</div>` : ""}
          ${sp.org ? `<div class="sp-org">${esc(sp.org)}</div>` : ""}
        </div>
      </div>`
      : "";

  const brand = config.brand?.trim()
    ? `
      <div class="brand">
        <div class="brand-name">${esc(config.brand)}</div>
        ${config.brandSub ? `<div class="brand-sub">${esc(config.brandSub)}</div>` : ""}
      </div>`
    : "";

  const badge = config.badge.trim()
    ? `<span class="badge"><span class="badge-dot"></span>${esc(config.badge)}</span>`
    : "";

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
    color: ${t.text};
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
    background:
      linear-gradient(90deg, rgba(2,18,18,${t.scrim}) 0%, rgba(2,18,18,${t.scrim * 0.5}) 42%, rgba(2,18,18,0) 78%),
      linear-gradient(0deg, rgba(2,18,18,${Math.min(0.85, t.scrim + 0.2)}) 0%, rgba(2,18,18,0) 46%);
  }
  .content {
    position: relative; z-index: 2;
    width: 100%; height: 100%;
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
  .brand-name { font-size: ${Math.round(22 * u)}px; font-weight: 800; letter-spacing: -0.01em; }
  .brand-sub {
    font-size: ${Math.round(10 * u)}px; font-weight: 600; opacity: 0.75;
    text-transform: uppercase; letter-spacing: 0.16em; margin-top: ${Math.round(2 * u)}px;
  }
</style>
</head>
<body>
  <div id="header">
    <iframe class="aura" title="" aria-hidden="true" tabindex="-1"
            src="${esc(auraEmbedUrl(config.auraSlug))}"></iframe>
    <div class="scrim"></div>
    <div class="content">
      <div>${badge}</div>
      <div class="mid">
        <h1 class="title">${esc(config.title)}</h1>
        ${config.subtitle?.trim() ? `<p class="title" style="font-size:${Math.round(20 * u)}px;font-weight:500;opacity:.9;margin-top:${Math.round(14 * u)}px">${esc(config.subtitle)}</p>` : ""}
        ${chips ? `<div class="chips">${chips}</div>` : ""}
      </div>
      <div class="footer">
        ${speaker || "<span></span>"}
        ${brand || "<span></span>"}
      </div>
    </div>
  </div>
</body>
</html>`;
}
