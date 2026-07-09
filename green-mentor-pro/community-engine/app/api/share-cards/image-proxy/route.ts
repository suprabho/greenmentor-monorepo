/**
 * Same-origin proxy for remote article images. Two reasons it exists:
 *   1. news CDNs often block hotlinked <img> requests (referer checks);
 *   2. the export render page loads in a cookie-less headless browser, so any
 *      image it references must resolve from OUR origin without a session.
 *
 * It is therefore on the middleware's public-path list — hardened via the
 * shared fetchGuarded() SSRF guard: http(s) only, private/loopback hosts
 * refused, image content-types only, ~15 MB cap. Streams bytes and never
 * forwards cookies or headers.
 */

import { fetchGuarded } from "@/lib/security/urlGuard";

const MAX_BYTES = 15 * 1024 * 1024;

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url");
  if (!raw) return new Response("Missing url", { status: 400 });

  const result = await fetchGuarded(raw, { accept: "image/*" });
  if (!result.ok) return new Response(result.message, { status: result.status });
  const upstream = result.response;
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
