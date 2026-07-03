/**
 * Same-origin proxy for remote article images. Two reasons it exists:
 *   1. news CDNs often block hotlinked <img> requests (referer checks);
 *   2. the export render page loads in a cookie-less headless browser, so any
 *      image it references must resolve from OUR origin without a session.
 *
 * It is therefore on the middleware's public-path list — hardened accordingly:
 * http(s) only, private/loopback hosts refused, image content-types only,
 * ~15 MB cap. It streams bytes and never forwards cookies or headers.
 */

const MAX_BYTES = 15 * 1024 * 1024;

/** Refuse obviously-internal targets (SSRF). DNS-level tricks are out of scope
 *  for an image tag proxy, but don't let literal private addresses through. */
function isBlockedHost(hostname: string): boolean {
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

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url");
  if (!raw) return new Response("Missing url", { status: 400 });

  const validate = (u: string): URL | null => {
    let parsed: URL;
    try {
      parsed = new URL(u);
    } catch {
      return null;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (isBlockedHost(parsed.hostname)) return null;
    return parsed;
  };

  let target = validate(raw);
  if (!target) return new Response("URL not allowed", { status: 400 });

  // Follow redirects by hand so EVERY hop is validated — an allowed host must
  // not be able to 302 the proxy into a private address.
  let upstream: Response | null = null;
  try {
    for (let hop = 0; hop < 4; hop++) {
      const res: Response = await fetch(target, {
        headers: { Accept: "image/*" },
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        target = validate(new URL(location, target).toString());
        if (!target) return new Response("Redirect target not allowed", { status: 400 });
        continue;
      }
      upstream = res;
      break;
    }
  } catch {
    return new Response("Upstream fetch failed", { status: 502 });
  }
  if (!upstream) return new Response("Too many redirects", { status: 502 });
  if (!upstream.ok || !upstream.body) {
    return new Response(`Upstream ${upstream.status}`, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return new Response("Not an image", { status: 415 });
  }
  const len = Number(upstream.headers.get("content-length"));
  if (Number.isFinite(len) && len > MAX_BYTES) {
    return new Response("Image too large", { status: 413 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
