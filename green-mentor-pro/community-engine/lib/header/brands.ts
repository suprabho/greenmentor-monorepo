// Brand catalog — the set of selectable brand lockups for the Aura Header Studio.
//
// The studio brand is never free text: you pick one of these. Each brand owns
// its wordmark art, so a header always renders a real, designed lockup.
//
// Today this is a single hardcoded entry (GreenMentor) backed by the inlined
// wordmark SVG. The shape deliberately mirrors a future Supabase `brands` row
// (id, name, subline, wordmark_svg, native_color) so moving the source to
// Supabase is a one-place change: make listBrands()/getBrand() async and fetch.
// Every consumer — the studio picker, the renderer, the export route, the skill
// CLI — goes through these accessors, so nothing else has to change.

import { BRAND_GREEN, type HeaderConfig } from "./types";
import { WORDMARK_SVG } from "./wordmark";

export type Brand = {
  /** Stable slug — the select value and the value stored in config.brandId. */
  id: string;
  /** Display name; also the wordmark image's alt text. */
  name: string;
  /** Default subline under the wordmark. The studio can override it. */
  sub?: string;
  /** Inlined, origin-free wordmark SVG markup (renders identically everywhere). */
  wordmarkSvg: string;
  /** The wordmark's native stroke color, swapped out when recoloring the logo. */
  nativeColor: string;
};

export const BRANDS: Brand[] = [
  {
    id: "greenmentor",
    name: "GreenMentor",
    sub: "Sustainability Simplified",
    wordmarkSvg: WORDMARK_SVG,
    nativeColor: BRAND_GREEN,
  },
];

export const DEFAULT_BRAND_ID = BRANDS[0].id;

/** All selectable brands, in display order. (Becomes a Supabase fetch later.) */
export function listBrands(): Brand[] {
  return BRANDS;
}

/** Resolve a brand id to a Brand, falling back to the default so old/empty
 *  configs always render something valid. */
export function getBrand(id: string | undefined): Brand {
  return BRANDS.find((b) => b.id === id) ?? BRANDS[0];
}

/** The brand selected by a config. */
export function brandFor(config: HeaderConfig): Brand {
  return getBrand(config.brandId);
}
