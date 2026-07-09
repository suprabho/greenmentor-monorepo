/**
 * Shared SSRF guard for server-side fetches of admin-supplied URLs (the
 * share-cards image proxy, and the Stories compose pipeline's link sources).
 * http(s) only, private/loopback hosts refused, every redirect hop
 * re-validated by hand — an allowed host must not be able to 302 the fetch
 * into a private address. DNS-level tricks are out of scope; this only
 * refuses literal private/reserved addresses and hostnames.
 */

/** Refuse obviously-internal targets. */
export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  // IPv6 loopback / link-local literals.
  if (h.includes(":")) return true;
  // IPv4 literals in private/reserved ranges.
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

/** Parses and validates a URL: http(s) protocol only, host not blocked. */
export function validateFetchUrl(raw: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (isBlockedHost(parsed.hostname)) return null;
  return parsed;
}

export type FetchGuardedResult =
  | { ok: true; response: Response }
  | { ok: false; status: number; message: string };

/**
 * Fetches a URL, following redirects by hand so every hop is re-validated.
 * Never forwards cookies or extra headers beyond `accept`.
 */
export async function fetchGuarded(
  rawUrl: string,
  opts: { accept?: string; timeoutMs?: number; maxRedirects?: number } = {}
): Promise<FetchGuardedResult> {
  const { accept, timeoutMs = 15_000, maxRedirects = 4 } = opts;

  let target = validateFetchUrl(rawUrl);
  if (!target) return { ok: false, status: 400, message: "URL not allowed" };

  try {
    for (let hop = 0; hop < maxRedirects; hop++) {
      const res: Response = await fetch(target, {
        headers: accept ? { Accept: accept } : undefined,
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        target = validateFetchUrl(new URL(location, target).toString());
        if (!target) return { ok: false, status: 400, message: "Redirect target not allowed" };
        continue;
      }
      return { ok: true, response: res };
    }
  } catch {
    return { ok: false, status: 502, message: "Upstream fetch failed" };
  }
  return { ok: false, status: 502, message: "Too many redirects" };
}
