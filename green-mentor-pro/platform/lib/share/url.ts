// Canonical origin for the platform.
//
// Needed on the server for metadataBase and og:image — Next can't turn a
// relative image path into the absolute URL crawlers require without it.
// Client components don't use this: ShareButton reads window.location.origin,
// which is always right in dev, preview and production.

const LOCAL = "http://localhost:3000";

/**
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL          — set this in production; it's the only
 *                                      value that survives a custom domain
 *   2. VERCEL_PROJECT_PRODUCTION_URL — the stable production domain
 *   3. VERCEL_URL                    — the per-deployment preview domain
 *   4. localhost:3000                — matches `npm run dev`
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return withProtocol(stripTrailingSlash(explicit));

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercel) return withProtocol(stripTrailingSlash(vercel));

  return LOCAL;
}

/** Absolute URL for an app-relative path ("/jobs/foo-3f8a1c2e9d"). */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function withProtocol(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}
