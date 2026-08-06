/**
 * Thumbnail discovery for feed articles.
 *
 * Two stages, in order of cost:
 *
 *  1. {@link imageFrom} — pull a picture out of the RSS item itself. Free, but
 *     plenty of feeds carry nothing usable (edie's ships no enclosure, no
 *     media:* and no inline <img> at all, which is why 142 of its articles had
 *     a null image_url).
 *  2. {@link ogImageFrom} — fetch the article page and read its Open Graph
 *     card. One extra HTTP request, so it only runs for items that made it
 *     past the relevance gate and are actually about to be inserted.
 *
 * Shared by the nightly worker (scripts/ingest-feed.ts) and the backfill
 * (scripts/backfill-article-images.ts) so the two can't drift.
 */

export const FEED_USER_AGENT = "GreenMentorPro/0.1 feed-worker";

/** Publisher pages are HTML we only skim; don't let a slow one stall the run. */
const PAGE_TIMEOUT_MS = 8_000;
/** og:* lives in <head>; 256 KB is far past it even on bloated pages. */
const MAX_PAGE_BYTES = 256 * 1024;

/**
 * Avatars, tracking pixels and chrome that show up as the first <img> in a
 * feed's HTML body. Matching one of these is worth falling through to the next
 * candidate — a Gravatar thumbnail is worse than the gradient fallback.
 */
const JUNK_IMAGE =
  /(gravatar|feedburner|feedsportal|feeds\.|doubleclick|googletagmanager|scorecardresearch|\/pixel|pixel\.(gif|png)|spacer|transparent|blank\.gif|1x1|\bad[-_]?banner)/i;

/** Read one attribute off a single tag, tolerating single or double quotes. */
function attr(tagText: string, name: string): string | undefined {
  const m = tagText.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m?.[1]?.trim() || undefined;
}

function tagsNamed(block: string, name: string): string[] {
  return block.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
}

/**
 * Absolutise against the page it came from and reject anything we can't put in
 * an <img src>: data: URIs, javascript:, protocol garbage.
 */
export function normalizeImageUrl(raw: string | undefined, base?: string): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

function usable(raw: string | undefined, base?: string): string | undefined {
  const url = normalizeImageUrl(raw, base);
  return url && !JUNK_IMAGE.test(url) ? url : undefined;
}

/**
 * Best-effort thumbnail from an RSS/Atom item block: enclosure, media:*, or an
 * inline <img> in the description/content. Candidates are ranked, not
 * first-match — feeds routinely put a 1×1 beacon or an author avatar ahead of
 * the real hero image.
 */
export function imageFrom(block: string, base?: string): string | undefined {
  // <enclosure type="image/jpeg" url="…"> — attribute order varies by feed.
  for (const tag of tagsNamed(block, "enclosure")) {
    const type = attr(tag, "type") ?? "";
    const url = attr(tag, "url");
    if (!/^image\//i.test(type) && !/\.(jpe?g|png|webp|gif|avif)([?#]|$)/i.test(url ?? "")) continue;
    const ok = usable(url, base);
    if (ok) return ok;
  }

  // <media:content> / <media:thumbnail> — prefer the widest, since feeds often
  // publish a thumbnail and a full-size version side by side.
  const media = [...tagsNamed(block, "media:content"), ...tagsNamed(block, "media:thumbnail")]
    .map((tag) => ({ url: usable(attr(tag, "url"), base), width: Number(attr(tag, "width") ?? 0) }))
    .filter((c): c is { url: string; width: number } => !!c.url)
    .sort((a, b) => b.width - a.width);
  if (media.length) return media[0].url;

  // Inline <img> in the description / content:encoded.
  for (const tag of tagsNamed(block, "img")) {
    const width = Number(attr(tag, "width") ?? 0);
    const height = Number(attr(tag, "height") ?? 0);
    if ((width && width <= 2) || (height && height <= 2)) continue; // beacon
    const ok = usable(attr(tag, "src") ?? attr(tag, "data-src"), base);
    if (ok) return ok;
  }

  return undefined;
}

/** og:image and its usual understudies, in the order we'd rather have them. */
const META_KEYS = ["og:image:secure_url", "og:image:url", "og:image", "twitter:image", "twitter:image:src"];

/** Pull the social-card image out of a page's <head>. */
export function ogImageFromHtml(html: string, pageUrl: string): string | undefined {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  const byKey = new Map<string, string>();
  for (const tag of metas) {
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? "").toLowerCase();
    if (!key || byKey.has(key)) continue; // first wins, matching crawler behaviour
    const content = attr(tag, "content");
    if (content) byKey.set(key, content);
  }

  for (const key of META_KEYS) {
    const ok = usable(byKey.get(key), pageUrl);
    if (ok) return ok;
  }

  // Last resort: the old <link rel="image_src"> convention, still used by some
  // Indian outlets' CMS templates.
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/\bimage_src\b/i.test(attr(tag, "rel") ?? "")) continue;
    const ok = usable(attr(tag, "href"), pageUrl);
    if (ok) return ok;
  }

  return undefined;
}

/** Throttling responses worth waiting out rather than treating as "no image". */
const RETRYABLE_STATUS = new Set([429, 503]);
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 30_000;
/** Floor on Retry-After: a server may say 0, but we still shouldn't hot-loop it. */
const RETRY_MIN_MS = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Honour Retry-After (seconds or HTTP-date), else exponential backoff. */
function retryDelay(res: Response, attempt: number): number {
  const header = res.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
    if (Number.isFinite(ms) && ms >= 0) return Math.min(Math.max(ms, RETRY_MIN_MS), RETRY_MAX_MS);
  }
  return Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
}

/**
 * Fetch an article page and read its og:image. Reads only as far as `</head>`
 * (or MAX_PAGE_BYTES) so a 2 MB article body never gets pulled down.
 *
 * Always resolves — a publisher being slow, gone or hostile just means this
 * article keeps the gradient fallback, which is not worth failing an ingest run
 * over. The one exception is throttling: a 429 means "ask again later", not
 * "no image", and treating the two alike silently loses pictures in bulk (edie
 * started 429ing ~80 articles into the first backfill run). Hence `retries`,
 * which the nightly worker leaves at 0 — it only fetches a handful per source.
 */
export async function ogImageFrom(pageUrl: string, { retries = 0 }: { retries?: number } = {}): Promise<string | undefined> {
  let res: Response;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(pageUrl, {
        headers: { "user-agent": FEED_USER_AGENT, accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
        redirect: "follow",
      });
    } catch {
      return undefined;
    }
    if (!RETRYABLE_STATUS.has(res.status) || attempt >= retries) break;
    await sleep(retryDelay(res, attempt));
  }
  if (!res.ok || !res.body) return undefined;
  if (!/text\/html|application\/xhtml/i.test(res.headers.get("content-type") ?? "")) return undefined;

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let html = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (html.length >= MAX_PAGE_BYTES || /<\/head>/i.test(html)) break;
    }
  } catch {
    return undefined;
  } finally {
    // We usually stop mid-body; drop the rest of the connection rather than
    // draining a whole article we don't want.
    void reader.cancel().catch(() => {});
  }

  return ogImageFromHtml(html, res.url || pageUrl);
}
