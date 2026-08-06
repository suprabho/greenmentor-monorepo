import { describe, it, expect } from "vitest";
import { parseDate, parseFeed } from "./rss";

describe("parseDate", () => {
  it("handles the RFC-822 dates most feeds emit", () => {
    expect(parseDate("Wed, 05 Aug 2026 08:25:27 +0000")).toBe("2026-08-05T08:25:27.000Z");
  });

  it("handles ISO-8601 (Atom)", () => {
    expect(parseDate("2026-08-05T08:25:27Z")).toBe("2026-08-05T08:25:27.000Z");
  });

  // The regression that made every SEBI article invisible: Date() rejects this
  // outright, published_at went null, and nullsFirst:false sank the rows.
  it("repairs SEBI's `05 Aug, 2026 +0530` — comma before the year, no clock", () => {
    expect(parseDate("05 Aug, 2026 +0530")).toBe("2026-08-04T18:30:00.000Z");
  });

  it("returns null rather than an Invalid Date for junk or nothing", () => {
    expect(parseDate("not a date")).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });
});

describe("parseFeed", () => {
  it("reads title, link, date and an enclosure image (Economic Times shape)", () => {
    const items = parseFeed(`<rss><channel><item>
      <title><![CDATA[Delhi's clean air project]]></title>
      <link>https://economictimes.indiatimes.com/news/environment/x/articleshow/1.cms</link>
      <description><![CDATA[World Bank funds 65% of the seven-year project.]]></description>
      <enclosure type="image/jpeg" url="https://img.etimg.com/photo/msid-1.cms" length="0"/>
      <pubDate>Wed, 05 Aug 2026 08:25:27 +0000</pubDate>
    </item></channel></rss>`);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Delhi's clean air project");
    expect(items[0].link).toBe("https://economictimes.indiatimes.com/news/environment/x/articleshow/1.cms");
    expect(items[0].image).toBe("https://img.etimg.com/photo/msid-1.cms");
    expect(items[0].publishedAt).toBe("2026-08-05T08:25:27.000Z");
  });

  it("finds the inline <img> WordPress feeds bury in the description", () => {
    const items = parseFeed(`<rss><channel><item>
      <title>Mombak delivers credits</title>
      <link>https://www.esgtoday.com/mombak/</link>
      <description><![CDATA[<p><img width="792" height="501" src="https://www.esgtoday.com/wp-content/uploads/2026/08/Mombak.jpg" alt="" /></p>Brazil-based developer…]]></description>
      <pubDate>Wed, 05 Aug 2026 08:25:27 +0000</pubDate>
    </item></channel></rss>`);

    expect(items[0].image).toBe("https://www.esgtoday.com/wp-content/uploads/2026/08/Mombak.jpg");
  });

  // edie's real shape: no enclosure, no media:*, no img. The worker falls back
  // to fetching the page's og:image for these.
  it("leaves image undefined when the item carries none", () => {
    const items = parseFeed(`<rss><channel><item>
      <title>VW goes full steam ahead on electrification</title>
      <link>https://www.edie.net/vw-electrification/</link>
      <pubDate>Wed, 05 Aug 2026 16:03:52 +0000</pubDate>
    </item></channel></rss>`);

    expect(items[0].image).toBeUndefined();
    expect(items[0].publishedAt).toBe("2026-08-05T16:03:52.000Z");
  });

  it("parses Atom entries, taking the link from href", () => {
    const items = parseFeed(`<feed><entry>
      <title>Atom item</title>
      <link rel="alternate" href="https://example.org/a"/>
      <updated>2026-08-05T10:00:00Z</updated>
      <summary>Body</summary>
    </entry></feed>`);

    expect(items[0].link).toBe("https://example.org/a");
    expect(items[0].publishedAt).toBe("2026-08-05T10:00:00.000Z");
  });

  it("drops items with no title or no link", () => {
    expect(parseFeed(`<rss><channel><item><title>Orphan</title></item></channel></rss>`)).toHaveLength(0);
  });
});
