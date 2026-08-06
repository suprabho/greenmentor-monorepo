import { describe, it, expect, vi, afterEach } from "vitest";
import { imageFrom, normalizeImageUrl, ogImageFrom, ogImageFromHtml } from "./images";

describe("imageFrom", () => {
  it("reads an <enclosure> regardless of attribute order", () => {
    expect(imageFrom(`<enclosure type="image/jpeg" url="https://cdn.example/a.jpg" length="0"/>`))
      .toBe("https://cdn.example/a.jpg");
    expect(imageFrom(`<enclosure url="https://cdn.example/b.jpg" type="image/jpeg"/>`))
      .toBe("https://cdn.example/b.jpg");
  });

  it("ignores non-image enclosures like podcast audio", () => {
    expect(imageFrom(`<enclosure type="audio/mpeg" url="https://cdn.example/ep.mp3"/>`)).toBeUndefined();
  });

  it("prefers the widest media:content when a feed ships several sizes", () => {
    const block = `
      <media:thumbnail url="https://cdn.example/small.jpg" width="150"/>
      <media:content url="https://cdn.example/large.jpg" width="1200"/>
      <media:content url="https://cdn.example/medium.jpg" width="600"/>`;
    expect(imageFrom(block)).toBe("https://cdn.example/large.jpg");
  });

  it("accepts single-quoted attributes", () => {
    expect(imageFrom(`<img src='https://cdn.example/c.jpg' />`)).toBe("https://cdn.example/c.jpg");
  });

  // The reason this ranks candidates instead of taking the first match: feeds
  // routinely lead with a beacon or the author's avatar.
  it("skips tracking pixels and gravatars in favour of the real hero", () => {
    const block = `
      <img src="https://feeds.example/~r/site/~4/abc" width="1" height="1"/>
      <img src="https://secure.gravatar.com/avatar/deadbeef?s=96"/>
      <img src="https://cdn.example/hero.jpg" width="792" height="501"/>`;
    expect(imageFrom(block)).toBe("https://cdn.example/hero.jpg");
  });

  it("resolves a relative src against the article URL", () => {
    expect(imageFrom(`<img src="/media/hero.jpg"/>`, "https://news.example/story/1"))
      .toBe("https://news.example/media/hero.jpg");
  });

  it("returns undefined for an item with nothing usable", () => {
    expect(imageFrom(`<title>No pictures here</title>`)).toBeUndefined();
    expect(imageFrom(`<img src="data:image/gif;base64,R0lGOD"/>`)).toBeUndefined();
  });
});

describe("ogImageFromHtml", () => {
  const page = "https://www.edie.net/vw-electrification/";

  it("reads og:image", () => {
    const html = `<head><meta property="og:image" content="https://edienetlive.s3.eu-west-2.amazonaws.com/vw.jpg"></head>`;
    expect(ogImageFromHtml(html, page)).toBe("https://edienetlive.s3.eu-west-2.amazonaws.com/vw.jpg");
  });

  it("prefers og:image:secure_url over the plain and twitter variants", () => {
    const html = `<head>
      <meta name="twitter:image" content="https://cdn.example/twitter.jpg">
      <meta property="og:image" content="http://cdn.example/plain.jpg">
      <meta property="og:image:secure_url" content="https://cdn.example/secure.jpg">
    </head>`;
    expect(ogImageFromHtml(html, page)).toBe("https://cdn.example/secure.jpg");
  });

  it("falls back to twitter:image, then <link rel=image_src>", () => {
    expect(ogImageFromHtml(`<meta name="twitter:image" content="https://cdn.example/t.jpg">`, page))
      .toBe("https://cdn.example/t.jpg");
    expect(ogImageFromHtml(`<link rel="image_src" href="/legacy.jpg">`, page))
      .toBe("https://www.edie.net/legacy.jpg");
  });

  it("returns undefined when the head has no card image", () => {
    expect(ogImageFromHtml(`<head><title>Story</title></head>`, page)).toBeUndefined();
  });
});

describe("ogImageFrom throttling", () => {
  afterEach(() => vi.unstubAllGlobals());

  const htmlResponse = () =>
    new Response('<head><meta property="og:image" content="https://cdn.example/hero.jpg"></head>', {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  const throttled = () => new Response("slow down", { status: 429, headers: { "retry-after": "0" } });

  // The bug this guards: a 429 is "ask again later", not "no image". Treating
  // them alike silently dropped 64 edie pictures mid-backfill.
  it("retries a 429 and succeeds on the next attempt", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(throttled()).mockResolvedValueOnce(htmlResponse());
    vi.stubGlobal("fetch", fetchMock);

    await expect(ogImageFrom("https://news.example/a", { retries: 2 })).resolves.toBe("https://cdn.example/hero.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retry budget and returns undefined", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(throttled()));
    vi.stubGlobal("fetch", fetchMock);

    await expect(ogImageFrom("https://news.example/a", { retries: 2 })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("does not retry by default — the nightly worker fetches too few pages to be throttled", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(throttled()));
    vi.stubGlobal("fetch", fetchMock);

    await expect(ogImageFrom("https://news.example/a")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a plain 404 — that page really has no image", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("gone", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(ogImageFrom("https://news.example/a", { retries: 3 })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("normalizeImageUrl", () => {
  it("rejects non-http protocols", () => {
    expect(normalizeImageUrl("javascript:alert(1)")).toBeUndefined();
    expect(normalizeImageUrl("data:image/png;base64,iVBOR")).toBeUndefined();
  });

  it("keeps query strings intact", () => {
    expect(normalizeImageUrl("https://img.etimg.com/photo/msid-1.cms?w=800"))
      .toBe("https://img.etimg.com/photo/msid-1.cms?w=800");
  });
});
