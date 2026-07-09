/**
 * Reads a Substack publication's RSS feed (https://<handle>.substack.com/feed)
 * into post records for the Stories compose pipeline. Unlike the platform's
 * ingest-feed parseFeed() — which only reads <description> — this pulls
 * <content:encoded> (the full post body) and reduces it to plaintext, so an
 * imported post grounds a draft with the whole article, not just the blurb.
 *
 * Fetched through fetchGuarded() so the same SSRF protection as the link-source
 * path applies.
 */
import { fetchGuarded } from "@/lib/security/urlGuard";
import { htmlToPlainText } from "@/lib/stories/compose";

export const DEFAULT_SUBSTACK_FEED = "https://greenmentor101.substack.com/feed";

export interface SubstackPost {
  title: string;
  url: string;
  publishedAt: string | null;
  /** Plaintext of the full post body (content:encoded), else the description. */
  text: string;
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

/** First inner text of <name>…</name> within an item block (name may contain a
 *  namespace colon, e.g. content:encoded). Returns the raw inner XML. */
function pick(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? m[1] : undefined;
}

export function parseSubstackFeed(xml: string, limit: number): SubstackPost[] {
  const items = xml
    .split(/<item[\s>]/i)
    .slice(1)
    .map((b) => b.split(/<\/item>/i)[0] ?? "");

  const posts: SubstackPost[] = [];
  for (const b of items) {
    if (posts.length >= limit) break;
    const title = decode(pick(b, "title") ?? "");
    const link = decode(pick(b, "link") ?? "");
    if (!title || !link) continue;

    const rawBody = pick(b, "content:encoded") ?? pick(b, "description") ?? "";
    const text = htmlToPlainText(decode(rawBody));

    let publishedAt: string | null = null;
    const pub = pick(b, "pubDate");
    if (pub) {
      const d = new Date(decode(pub));
      if (!Number.isNaN(d.getTime())) publishedAt = d.toISOString();
    }

    posts.push({ title, url: link, publishedAt, text });
  }
  return posts;
}

export async function fetchSubstackPosts(
  feedUrl: string = DEFAULT_SUBSTACK_FEED,
  limit = 6
): Promise<SubstackPost[]> {
  const result = await fetchGuarded(feedUrl, {
    accept: "application/rss+xml, application/xml, text/xml",
  });
  if (!result.ok) throw new Error(result.message);
  if (!result.response.ok) throw new Error(`Upstream ${result.response.status}`);
  const xml = await result.response.text();
  return parseSubstackFeed(xml, limit);
}
