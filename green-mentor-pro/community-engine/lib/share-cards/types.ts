// Share Cards Studio — shared config contract.
//
// A single ShareCardSnapshotV1 drives three surfaces that must never drift:
//   1. the live composer preview   (app/share-cards)
//   2. the chrome-less render page (app/share-cards/render — what Playwright shoots)
//   3. the export API              (app/api/share-cards/export)
//
// All three render through lib/share-cards/CardStage.tsx, so this type is the
// contract. Follows the footshorts share-card discipline: every optional /
// additive field is read back with `?? default` (see normalizeSnapshot) so old
// snapshots round-trip unchanged.

import type { ComposerLayer, LayerGroup } from "@vismay/viz-admin";
import { BRAND_GREEN, type BrandLogo } from "@/lib/header/types";

// ── output geometry ──────────────────────────────────────────────────────────

/** Output aspect ratios the studio supports. */
export type GmAspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

export const ASPECT_RATIOS: Array<{ id: GmAspectRatio; label: string }> = [
  { id: "1:1", label: "Square 1:1" },
  { id: "4:5", label: "Portrait 4:5" },
  { id: "9:16", label: "Story 9:16" },
  { id: "16:9", label: "Wide 16:9" },
];

/** Exported pixel dimensions per ratio. The stage renders at
 *  OUTPUT × CARD_RENDER_SCALE and export recovers full pixels via
 *  deviceScaleFactor (= 1 / CARD_RENDER_SCALE). */
export const OUTPUT_SIZE: Record<GmAspectRatio, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
  "16:9": { w: 1600, h: 900 },
};

/** Shrink factor from output px → stage intrinsic px. Lower = fixed-px content
 *  (text, chips) occupies a larger share of the card, i.e. bigger type on export. */
export const CARD_RENDER_SCALE = 0.5;

export const DEFAULT_RATIO: GmAspectRatio = "1:1";

export function stageSizeFor(ratio: GmAspectRatio): { w: number; h: number } {
  const out = OUTPUT_SIZE[ratio] ?? OUTPUT_SIZE[DEFAULT_RATIO];
  return { w: Math.round(out.w * CARD_RENDER_SCALE), h: Math.round(out.h * CARD_RENDER_SCALE) };
}

// ── background ───────────────────────────────────────────────────────────────

/** The card backdrop. `aura` embeds the live animated aura.promad.design iframe —
 *  the Playwright export waits for it to settle and captures the real animation
 *  frame (same approach as the header studio; no poster still needed). `image`
 *  is a remote URL (proxied on render) or an uploaded data URL. */
export type CardBackground =
  | { type: "none" }
  | { type: "aura"; slug: string }
  | { type: "image"; src: string };

// ── theme ────────────────────────────────────────────────────────────────────

export type GmCardThemeId = "teal" | "light" | "ink" | "gradient";

export interface GmCardTheme {
  id: GmCardThemeId;
  label: string;
  /** CSS background for the card base (color or gradient). */
  bg: string;
  /** Flat hex used for swatches + as the export page background. */
  solidBg: string;
  text: string;
  muted: string;
}

/** Card themes derived from the Greenmentor pitch-deck tokens (app/globals.css). */
export const GM_CARD_THEMES: Record<GmCardThemeId, GmCardTheme> = {
  teal: {
    id: "teal",
    label: "Deep teal",
    bg: "#014A50",
    solidBg: "#014A50",
    text: "#FFFFFF",
    muted: "rgba(255,255,255,0.72)",
  },
  light: {
    id: "light",
    label: "Light",
    bg: "#F6F7F6",
    solidBg: "#F6F7F6",
    text: "#0A0A0A",
    muted: "#5D5D5D",
  },
  ink: {
    id: "ink",
    label: "Ink",
    bg: "#0A0A0A",
    solidBg: "#0A0A0A",
    text: "#FFFFFF",
    muted: "#A8A8A8",
  },
  gradient: {
    id: "gradient",
    label: "Stat band",
    bg: "linear-gradient(180deg, #164E4F 0%, #07D862 100%)",
    solidBg: "#164E4F",
    text: "#FFFFFF",
    muted: "rgba(255,255,255,0.78)",
  },
};

export const THEME_IDS = Object.keys(GM_CARD_THEMES) as GmCardThemeId[];

// ── frame ────────────────────────────────────────────────────────────────────

/** Frame-level styling shared by every card: theme + brand chrome + backdrop. */
export interface CardFrame {
  theme: GmCardThemeId;
  /** Accent hex for the eyebrow tick + accent-toned content. */
  accent: string;
  /** Small uppercase tag, top-left (e.g. "ESG BRIEF"). Empty hides it. */
  eyebrow: string;
  showEyebrow: boolean;
  /** Handle shown bottom-left (e.g. "greenmentor.io"). Empty hides it. */
  handle: string;
  /** Wordmark color + size (reuses the header studio's BrandLogo). */
  logo: BrandLogo;
  showLogo: boolean;
  background: CardBackground;
  /** Dark scrim over the background for content legibility (0–1). */
  backgroundScrim: number;
}

export function defaultFrame(): CardFrame {
  return {
    theme: "teal",
    accent: BRAND_GREEN,
    eyebrow: "ESG BRIEF",
    showEyebrow: true,
    handle: "greenmentor.io",
    logo: { color: BRAND_GREEN, scale: 1, fill: false },
    showLogo: true,
    background: { type: "none" },
    backgroundScrim: 0.35,
  };
}

/** CSS custom properties the stage root emits; module components consume these
 *  so every layer follows the frame's theme + accent. */
export function themeVarsFor(frame: CardFrame): Record<string, string> {
  const t = GM_CARD_THEMES[frame.theme] ?? GM_CARD_THEMES.teal;
  return {
    "--gmcard-bg": t.bg,
    "--gmcard-solid-bg": t.solidBg,
    "--gmcard-text": t.text,
    "--gmcard-muted": t.muted,
    "--gmcard-accent": frame.accent?.trim() || BRAND_GREEN,
  };
}

// ── snapshot (the persisted config) ──────────────────────────────────────────

/** The persisted card config (community_share_cards.config). Layers store
 *  PICKS (e.g. an articleId), never resolved data — modules resolve picks
 *  against the ShareCardDataProvider at render time, so a saved card re-renders
 *  fresh and only the exported PNG bakes data in. */
export interface ShareCardSnapshotV1 {
  version: 1;
  ratio: GmAspectRatio;
  frame: CardFrame;
  foreground: ComposerLayer[];
  groups?: LayerGroup[];
}

export function emptySnapshot(): ShareCardSnapshotV1 {
  return { version: 1, ratio: DEFAULT_RATIO, frame: defaultFrame(), foreground: [] };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function normalizeBackground(raw: unknown): CardBackground {
  if (raw && typeof raw === "object") {
    const b = raw as Record<string, unknown>;
    if (b.type === "aura" && typeof b.slug === "string" && b.slug.trim()) {
      return { type: "aura", slug: b.slug };
    }
    if (b.type === "image" && typeof b.src === "string" && b.src) {
      return { type: "image", src: b.src };
    }
  }
  return { type: "none" };
}

/** Tolerant parse of a stored/POSTed snapshot. Every field falls back to its
 *  default so configs saved by older studio versions keep loading. */
export function normalizeSnapshot(raw: unknown): ShareCardSnapshotV1 {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f = (r.frame && typeof r.frame === "object" ? r.frame : {}) as Record<string, unknown>;
  const d = defaultFrame();
  const logo = (f.logo && typeof f.logo === "object" ? f.logo : {}) as Record<string, unknown>;
  const ratio = typeof r.ratio === "string" && r.ratio in OUTPUT_SIZE ? (r.ratio as GmAspectRatio) : DEFAULT_RATIO;
  return {
    version: 1,
    ratio,
    frame: {
      theme: typeof f.theme === "string" && f.theme in GM_CARD_THEMES ? (f.theme as GmCardThemeId) : d.theme,
      accent: typeof f.accent === "string" && f.accent.trim() ? f.accent : d.accent,
      eyebrow: typeof f.eyebrow === "string" ? f.eyebrow : d.eyebrow,
      showEyebrow: typeof f.showEyebrow === "boolean" ? f.showEyebrow : d.showEyebrow,
      handle: typeof f.handle === "string" ? f.handle : d.handle,
      logo: {
        color: typeof logo.color === "string" && logo.color.trim() ? logo.color : BRAND_GREEN,
        scale: typeof logo.scale === "number" ? logo.scale : 1,
        fill: typeof logo.fill === "boolean" ? logo.fill : false,
      },
      showLogo: typeof f.showLogo === "boolean" ? f.showLogo : d.showLogo,
      background: normalizeBackground(f.background),
      backgroundScrim: typeof f.backgroundScrim === "number" ? clamp01(f.backgroundScrim) : d.backgroundScrim,
    },
    foreground: Array.isArray(r.foreground) ? (r.foreground as ComposerLayer[]) : [],
    groups: Array.isArray(r.groups) ? (r.groups as LayerGroup[]) : undefined,
  };
}

// ── data the layers resolve against ──────────────────────────────────────────

export interface ShareCardEntity {
  slug: string;
  name: string;
  /** framework | topic | region | company (matches public.entities.kind). */
  kind: string;
}

/** A news-pipe article as the card modules consume it — the pipeline page's row
 *  shape with entities flattened (mirrors the platform feed's FeedArticle). */
export interface ShareCardArticle {
  id: string;
  source: string;
  title: string;
  url: string;
  summary: string | null;
  image_url: string | null;
  published_at: string | null;
  entities: ShareCardEntity[];
}

export interface ShareCardData {
  articles: ShareCardArticle[];
}

/** The export/render handoff payload — snapshot + server-resolved picks. Never
 *  persisted; built per export by app/api/share-cards/export. */
export interface ShareCardRenderPayload {
  snapshot: ShareCardSnapshotV1;
  data: ShareCardData;
}

/** Every articleId referenced by the snapshot's layers — the export route
 *  resolves these server-side so the render page needs no client fetches. */
export function collectArticleIds(snapshot: ShareCardSnapshotV1): string[] {
  const ids = new Set<string>();
  for (const l of snapshot.foreground) {
    const cfg = l.layer as Record<string, unknown>;
    if (typeof cfg.articleId === "string" && cfg.articleId) ids.add(cfg.articleId);
  }
  return [...ids];
}
