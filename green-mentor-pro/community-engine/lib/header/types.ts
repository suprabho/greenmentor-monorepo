// Aura Header Studio — shared config contract.
//
// A single HeaderConfig drives three surfaces that must never drift:
//   1. the live editor preview      (app/header-studio)
//   2. the server export route       (app/api/header/export)
//   3. the CLI renderer for the skill (scripts/render-header.ts)
//
// All three render from lib/header/render.ts, so this type is the contract.

/** A speaker / host shown in the lower-left card (optional). */
export type HeaderSpeaker = {
  name: string;
  /** e.g. "Chief Sustainability Officer" */
  role?: string;
  /** e.g. "Mahindra Group" */
  org?: string;
  /** Absolute URL or app-relative path (e.g. "/avatars/supro.jpg"). */
  photo?: string;
  /**
   * Whether the speaker card renders. Undefined is treated as enabled so
   * older configs keep working; the studio toggle sets it explicitly.
   */
  enabled?: boolean;
};

/** A small pill in the meta row (mode / date / time). `icon` is an emoji glyph. */
export type HeaderChip = {
  label: string;
  icon?: string;
};

/** Output canvas sizes. Width/height are the *export* pixels (before 2x scale). */
export type SizePreset = {
  id: string;
  label: string;
  width: number;
  height: number;
};

export const SIZE_PRESETS: SizePreset[] = [
  { id: "newsletter", label: "Newsletter / LinkedIn (1200×627)", width: 1200, height: 627 },
  { id: "newsletter-strip", label: "Newsletter strip (1100×220)", width: 1100, height: 220 },
  { id: "webinar-wide", label: "Webinar 16:9 (1600×900)", width: 1600, height: 900 },
  { id: "wide", label: "Wide banner (1500×500)", width: 1500, height: 500 },
  { id: "square", label: "Square / Webinar (1080×1080)", width: 1080, height: 1080 },
  { id: "story", label: "Story / Reel (1080×1350)", width: 1080, height: 1350 },
];

export const DEFAULT_SIZE_ID = "newsletter";

/** An aura background option. `slug` is the path segment on aura.promad.design. */
export type AuraPreset = {
  id: string;
  label: string;
  /** scene-context-graph background type, for skill/UX guidance. */
  type: "aurora" | "fluid" | "liquid" | "ribbon" | "waves" | "particleRing" | "simple" | "dandelion";
  /** Slug under https://aura.promad.design/embed/<slug> */
  slug: string;
  /** True only for slugs confirmed live in production. */
  verified?: boolean;
  /** One-line "use this when…" hint. */
  hint?: string;
};

// NOTE: only `green-vibrant` is verified live (it powers the marketing Hero).
// The others are sensible defaults to try; if one 404s, paste any slug from
// https://aura.promad.design via the custom field. The skill explains how to
// pick a type using the scene-context-graph taxonomy.
export const AURA_PRESETS: AuraPreset[] = [
  {
    id: "green-vibrant",
    label: "Green Vibrant (brand default)",
    type: "fluid",
    slug: "green-background-vibrant-abstract-website-header-design",
    verified: true,
    hint: "On-brand teal→neon green blend. Safe default for any GreenMentor header.",
  },
];

/** The aura embed URL for a given slug, with chrome/text stripped. */
export function auraEmbedUrl(slug: string): string {
  const clean = slug.trim();
  // Allow pasting a full URL too — extract the slug.
  const fromUrl = clean.match(/aura\.promad\.design\/(?:embed|scene)\/([^?#/]+)/);
  const finalSlug = fromUrl ? fromUrl[1] : clean.replace(/^\/+|\/+$/g, "");
  return `https://aura.promad.design/embed/${finalSlug}?hideText=true`;
}

/** Theme controls for the text overlay legibility scrim + accent. */
export type HeaderTheme = {
  /** 0–1: darkness of the gradient scrim behind text. */
  scrim: number;
  /** Accent color for the badge pill + hairlines (hex). */
  accent: string;
  /** Body/heading text color (hex). */
  text: string;
  /**
   * Draw a frosted-glass card behind the headline block for extra legibility
   * over busy auras. Undefined/false = no card (the default look).
   */
  card?: boolean;
};

/** The GreenMentor brand green — the wordmark's native stroke color. */
export const BRAND_GREEN = "#07D862";

/** Appearance of the bottom-right GreenMentor wordmark lockup. */
export type BrandLogo = {
  /** Wordmark color (hex) — stroke when outline, fill when filled. */
  color: string;
  /** Size multiplier on each layout's base logo height. 1 = default. */
  scale: number;
  /** Solid-filled wordmark instead of the default hollow outline. */
  fill: boolean;
};

/** Brand-safe wordmark colors for the studio swatches (custom hex still allowed). */
export const LOGO_COLOR_PRESETS: { id: string; label: string; value: string }[] = [
  { id: "green", label: "Brand green", value: BRAND_GREEN },
  { id: "white", label: "White", value: "#FFFFFF" },
  { id: "teal", label: "Deep teal", value: "#014A50" },
];

/** Discrete wordmark sizes — a multiplier on each layout's base logo height. */
export const LOGO_SIZE_PRESETS: { id: string; label: string; scale: number }[] = [
  { id: "s", label: "S", scale: 0.75 },
  { id: "m", label: "M", scale: 1 },
  { id: "l", label: "L", scale: 1.4 },
];

export type HeaderConfig = {
  sizeId: string;
  /** Aura slug OR full aura.promad.design URL. */
  auraSlug: string;
  /** Small uppercase tag, e.g. "FIRESIDE CHAT". Empty hides it. */
  badge: string;
  title: string;
  subtitle?: string;
  chips: HeaderChip[];
  speaker?: HeaderSpeaker;
  /**
   * Which brand lockup to show bottom-right — a brand id from the catalog
   * (lib/header/brands.ts), e.g. "greenmentor". Resolved via getBrand(), which
   * falls back to the default brand, so an unknown/missing id still renders.
   */
  brandId?: string;
  /** Override the brand's default subline. Empty string hides the subline. */
  brandSub?: string;
  /**
   * @deprecated Legacy free-text brand name. Superseded by {@link brandId};
   * kept only so older saved configs keep parsing. Not used by the renderer.
   */
  brand?: string;
  /** Wordmark color + size. Omitted -> brand green at 1×. */
  logo?: BrandLogo;
  theme: HeaderTheme;
};

export const DEFAULT_CONFIG: HeaderConfig = {
  sizeId: DEFAULT_SIZE_ID,
  auraSlug: AURA_PRESETS[0].slug,
  badge: "FIRESIDE CHAT",
  title: "Navigating Energy Transition for Indian Industries: From Intent to Execution",
  subtitle: "",
  chips: [
    { icon: "🎥", label: "Virtual Mode" },
    { icon: "📅", label: "04 June, 2026" },
    { icon: "⏰", label: "4:00 – 5:00 PM IST" },
  ],
  speaker: {
    name: "Ankit Todi",
    role: "Chief Sustainability Officer",
    org: "Mahindra Group",
    photo: "/avatars/aditya.jpg",
    enabled: true,
  },
  brandId: "greenmentor",
  brandSub: "Sustainability Simplified",
  logo: { color: BRAND_GREEN, scale: 1, fill: false },
  theme: {
    scrim: 0.55,
    accent: BRAND_GREEN,
    text: "#FFFFFF",
    card: false,
  },
};

/** Resolve the logo config with defaults so partial/older configs stay valid. */
export function logoFor(config: HeaderConfig): BrandLogo {
  return {
    color: config.logo?.color?.trim() || BRAND_GREEN,
    scale: config.logo?.scale ?? 1,
    fill: config.logo?.fill ?? false,
  };
}

export function sizeFor(id: string): SizePreset {
  return SIZE_PRESETS.find((s) => s.id === id) ?? SIZE_PRESETS[0];
}
