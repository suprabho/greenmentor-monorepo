// Validation for the `?next=` parameter that carries someone back to where they
// were after signing in.
//
// Shared links make this path load-bearing: a stranger opens /webinars/:slug,
// hits RSVP, signs in, and has to land back on that webinar rather than /home.
// Every hop that forwards `next` (middleware, /auth/callback, the onboarding
// gate) runs it through here first.

/**
 * A `next` value is safe only if it's a same-origin absolute path.
 *
 * The "//" case is the one worth spelling out: "//evil.com" passes a naive
 * startsWith("/") check but browsers read it as protocol-relative and navigate
 * off-site. "/\evil.com" is the same trick with a backslash.
 */
export function safeNextHref(param: string | null | undefined, fallback = "/home"): string {
  if (!param) return fallback;
  const value = param.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

/** Split a `next` href into the parts NextURL wants set separately. */
export function splitHref(href: string): { pathname: string; search: string } {
  const hash = href.indexOf("#");
  const withoutHash = hash === -1 ? href : href.slice(0, hash);
  const q = withoutHash.indexOf("?");
  if (q === -1) return { pathname: withoutHash, search: "" };
  return { pathname: withoutHash.slice(0, q), search: withoutHash.slice(q) };
}
