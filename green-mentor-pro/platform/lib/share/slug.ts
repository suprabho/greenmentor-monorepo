// Share slugs — the per-item deeplink identifiers behind /webinars/:slug,
// /jobs/:slug and /feed/:slug.
//
// A share slug is `{slug}-{idPrefix}`, e.g. "ghg-lead-verifier-2-3f8a1c2e9d".
// The **idPrefix resolves the row**; the slug part is decorative. That split is
// what makes shared links durable: renaming a webinar never 404s a link someone
// already sent, and the detail page can 308 a stale slug to the canonical URL.
//
// slug/id_prefix are filled by the gm_set_share_keys() trigger — community-engine
// migration 0017_shareable_slugs.sql (webinars, jobs) and platform migration
// 0026_article_slugs.sql (articles).

/** Hex chars of the uuid kept in the URL. 16^10 ≈ 1.1e12 — collisions are
 *  vanishingly rare, and the resolver disambiguates on slug if one ever lands. */
export const ID_PREFIX_LEN = 10;

/** Slug used when a row has no title to derive one from. */
const FALLBACK_SLUG = "item";

const HEX_TAIL = new RegExp(`^(.*?)-([0-9a-f]{${ID_PREFIX_LEN}})$`);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirrors public.gm_slugify() in SQL — deliberately ASCII-only so the Postgres
 * side stays IMMUTABLE without an unaccent extension. Non-alphanumerics
 * collapse to a single dash; the result is trimmed and capped at 60 chars.
 *
 * Only used as a fallback for rows whose slug column is somehow blank; the
 * database is the source of truth for stored slugs.
 */
export function slugify(input: string | null | undefined): string {
  return (input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** The 10-hex-char prefix of a uuid, matching left(replace(id::text,'-',''), 10). */
export function idPrefix(id: string): string {
  return id.replace(/-/g, "").slice(0, ID_PREFIX_LEN).toLowerCase();
}

/** The canonical URL segment for a row: `{slug}-{idPrefix}`. */
export function shareSlug(slug: string | null | undefined, id: string): string {
  const base = slugify(slug) || FALLBACK_SLUG;
  return `${base}-${idPrefix(id)}`;
}

export type ShareParam =
  | { kind: "uuid"; id: string }
  | { kind: "slug"; slug: string; idPrefix: string };

/**
 * Parse a `[slug]` route param. Accepts a canonical share slug, or a bare uuid
 * so links minted before this scheme existed (and the old /webinars/:uuid/live
 * URLs) keep working — the page then redirects to the canonical form.
 *
 * Returns null for anything else, which the caller turns into a 404.
 */
export function parseShareParam(param: string): ShareParam | null {
  const value = decodeURIComponent(param ?? "").trim().toLowerCase();
  if (!value) return null;
  if (UUID_RE.test(value)) return { kind: "uuid", id: value };

  // Lazy prefix + the `$`-anchored fixed-width tail means the LAST 10-hex
  // segment wins, so slugs that themselves contain hex-looking words
  // ("abc-cafedecafe-3f8a1c2e9d") still split at the right dash.
  const match = HEX_TAIL.exec(value);
  if (!match) return null;
  return { kind: "slug", slug: match[1], idPrefix: match[2] };
}

/**
 * Choose the intended row when an id prefix matches more than one (a truncated
 * -uuid collision — see the note on ID_PREFIX_LEN). Prefers an exact slug match
 * and otherwise falls back to the first row, so a collision degrades to "maybe
 * the wrong item" rather than a 404.
 */
export function pickCanonical<T extends { slug: string | null }>(
  rows: T[],
  slug: string
): T | null {
  if (rows.length <= 1) return rows[0] ?? null;
  return rows.find((row) => slugify(row.slug) === slug) ?? rows[0];
}
