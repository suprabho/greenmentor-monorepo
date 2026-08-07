/**
 * Minimal RSS + Atom parsing for the feed worker.
 *
 * Deliberately regex-based rather than a real XML parser: syndication feeds are
 * well-formed enough for this, and it keeps the worker dependency-free. Lives
 * in lib/ rather than scripts/ so the fiddly bits — publisher date formats
 * above all — can be unit-tested.
 */
import { imageFrom } from "./images";

export type FeedItem = {
  title: string;
  link: string;
  /** ISO-8601, or null when the publisher gave us nothing parseable. */
  publishedAt: string | null;
  description?: string;
  image?: string;
};

const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&")
    .trim();
}

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? decode(m[1]) : undefined;
}

/**
 * Publisher timestamp → ISO string.
 *
 * `new Date()` handles RFC-822 and ISO-8601, which covers most feeds. SEBI is
 * the outlier: it emits `05 Aug, 2026 +0530` — a comma before the year and no
 * clock time — which Date() rejects outright. That used to leave published_at
 * null, and since the feed query orders by published_at with nullsFirst:false,
 * every SEBI item sank to the bottom and was never seen.
 */
export function parseDate(raw?: string): string | null {
  const value = raw?.trim();
  if (!value) return null;

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();

  const repaired = value
    .replace(/([A-Za-z]{3,}),\s*(\d{4})/, "$1 $2") // "Aug, 2026" → "Aug 2026"
    .replace(/(\d{4})\s+([+-]\d{4}\b|[+-]\d{2}:\d{2})/, "$1 00:00:00 $2"); // offset needs a clock

  const fixed = new Date(repaired);
  return Number.isNaN(fixed.getTime()) ? null : fixed.toISOString();
}

/** Split a feed document into its item/entry blocks. */
export function itemBlocks(xml: string): { blocks: string[]; isAtom: boolean } {
  const isAtom = /<entry[\s>]/i.test(xml) && !/<item[\s>]/i.test(xml);
  const splitTag = isAtom ? "entry" : "item";
  const blocks = xml
    .split(new RegExp(`<${splitTag}[\\s>]`, "i"))
    .slice(1)
    .map((b) => b.split(new RegExp(`</${splitTag}>`, "i"))[0]);
  return { blocks, isAtom };
}

export function parseFeed(xml: string): FeedItem[] {
  const { blocks, isAtom } = itemBlocks(xml);

  return blocks
    .map((b) => {
      const title = tag(b, "title") ?? "";
      let link = tag(b, "link") ?? "";
      if (isAtom) {
        const href = b.match(/<link[^>]*href="([^"]+)"/i);
        if (href) link = href[1];
      }
      link = link.trim();
      return {
        title: stripTags(title),
        link,
        publishedAt: parseDate(tag(b, "pubDate") ?? tag(b, "updated") ?? tag(b, "published")),
        description: stripTags(tag(b, "description") ?? tag(b, "summary") ?? tag(b, "content") ?? "").slice(0, 1200),
        // Resolve relative image paths against the article, not the feed.
        image: imageFrom(b, link || undefined),
      };
    })
    .filter((i) => i.title && i.link);
}
