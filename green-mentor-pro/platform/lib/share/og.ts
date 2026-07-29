import type { Metadata } from "next";

// Link-preview metadata for the shareable detail pages.
//
// Both halves of the /api/og contract live here: ogImageUrl() writes the query
// string, readOgParams() reads it back, so the clamps can't drift apart.

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const MAX_TITLE = 120;
const MAX_SUBTITLE = 90;
const MAX_BADGE = 24;
const MAX_DESCRIPTION = 200;

const DEFAULT_BADGE = "Green Mentor";

export type OgParams = { title: string; subtitle?: string | null; badge?: string | null };

/** Path to the generated social card. Relative — metadataBase makes it absolute. */
export function ogImageUrl({ title, subtitle, badge }: OgParams): string {
  const params = new URLSearchParams({ title: clamp(title, MAX_TITLE) });
  if (subtitle) params.set("subtitle", clamp(subtitle, MAX_SUBTITLE));
  if (badge) params.set("badge", clamp(badge, MAX_BADGE));
  return `/api/og?${params.toString()}`;
}

/** The /api/og side of the contract — same clamps, plus defaults for a bare hit. */
export function readOgParams(search: URLSearchParams): {
  title: string;
  subtitle: string | null;
  badge: string;
} {
  return {
    title: clamp(search.get("title") ?? "Green Mentor", MAX_TITLE),
    subtitle: search.get("subtitle") ? clamp(search.get("subtitle")!, MAX_SUBTITLE) : null,
    badge: clamp(search.get("badge") || DEFAULT_BADGE, MAX_BADGE),
  };
}

/**
 * Assemble the OpenGraph + Twitter block for a detail page.
 *
 * `image` is the item's own artwork when it has some — webinar covers are
 * already public 1200×627 CDN URLs from the Aura Header pipeline, and feed
 * articles carry the publisher's thumbnail. Anything without one falls back to
 * the generated card, so no link ever previews imageless.
 */
export function shareMetadata({
  title,
  description,
  path,
  image,
  badge,
  subtitle,
  type = "website",
  publishedTime,
}: {
  title: string;
  description?: string | null;
  path: string;
  image?: string | null;
  badge: string;
  subtitle?: string | null;
  type?: "website" | "article";
  publishedTime?: string | null;
}): Metadata {
  const desc = description ? clamp(collapse(description), MAX_DESCRIPTION) : undefined;
  const images = [image || ogImageUrl({ title, subtitle, badge })];

  return {
    // Document title carries the site suffix (matching every other page here);
    // og:/twitter: titles stay clean, since the preview card names the site itself.
    title: `${title} — Green Mentor Pro`,
    description: desc,
    alternates: { canonical: path },
    openGraph: {
      title,
      description: desc,
      url: path,
      type,
      images,
      ...(type === "article" && publishedTime ? { publishedTime } : {}),
    },
    twitter: { card: "summary_large_image", title, description: desc, images },
  };
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Truncate on a word boundary where possible, with an ellipsis. */
function clamp(value: string, max: number): string {
  const text = collapse(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
