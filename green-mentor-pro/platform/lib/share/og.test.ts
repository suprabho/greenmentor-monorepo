import { describe, it, expect, afterEach } from "vitest";
import { ogImageUrl, readOgParams, shareMetadata } from "./og";
import { absoluteUrl, siteUrl } from "./url";

const ENV_KEYS = ["NEXT_PUBLIC_SITE_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function only(key: (typeof ENV_KEYS)[number] | null, value?: string) {
  for (const k of ENV_KEYS) delete process.env[k];
  if (key) process.env[key] = value!;
}

describe("siteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL", () => {
    only("NEXT_PUBLIC_SITE_URL", "https://app.greenmentor.co");
    expect(siteUrl()).toBe("https://app.greenmentor.co");
  });

  it("adds https:// to the bare hostnames Vercel provides", () => {
    only("VERCEL_URL", "gm-pro-abc123.vercel.app");
    expect(siteUrl()).toBe("https://gm-pro-abc123.vercel.app");
  });

  it("prefers the stable production domain over the per-deploy one", () => {
    only(null);
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "app.greenmentor.co";
    process.env.VERCEL_URL = "gm-pro-abc123.vercel.app";
    expect(siteUrl()).toBe("https://app.greenmentor.co");
  });

  it("strips trailing slashes so absoluteUrl can't double up", () => {
    only("NEXT_PUBLIC_SITE_URL", "https://app.greenmentor.co///");
    expect(absoluteUrl("/jobs/x-3f8a1c2e9d")).toBe("https://app.greenmentor.co/jobs/x-3f8a1c2e9d");
  });

  it("falls back to the dev server origin", () => {
    only(null);
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("is a valid URL, since metadataBase does new URL() on it", () => {
    only(null);
    expect(() => new URL(siteUrl())).not.toThrow();
    only("VERCEL_URL", "gm-pro-abc123.vercel.app");
    expect(() => new URL(siteUrl())).not.toThrow();
  });
});

describe("ogImageUrl / readOgParams", () => {
  it("round-trips through the query string", () => {
    const url = ogImageUrl({ title: "Senior ESG Analyst", subtitle: "Tata Power", badge: "ESG Job" });
    const parsed = readOgParams(new URL(`http://x${url}`).searchParams);
    expect(parsed).toEqual({ title: "Senior ESG Analyst", subtitle: "Tata Power", badge: "ESG Job" });
  });

  it("escapes characters that would otherwise break the URL", () => {
    const url = ogImageUrl({ title: "Scope 3 & CSRD: what's next?" });
    expect(url).not.toContain(" ");
    expect(readOgParams(new URL(`http://x${url}`).searchParams).title).toBe("Scope 3 & CSRD: what's next?");
  });

  it("omits absent optional params rather than sending empty ones", () => {
    const url = ogImageUrl({ title: "Just a title", subtitle: null, badge: null });
    expect(url).toBe("/api/og?title=Just+a+title");
  });

  it("defaults a bare hit so the route never renders blank", () => {
    expect(readOgParams(new URLSearchParams())).toEqual({
      title: "Green Mentor",
      subtitle: null,
      badge: "Green Mentor",
    });
  });

  it("clamps long titles on a word boundary", () => {
    const long =
      "Comprehensive guide to Scope 3 value chain emissions accounting under the GHG Protocol for Indian listed entities filing BRSR Core";
    expect(long.length).toBeGreaterThan(120);
    const { title } = readOgParams(new URL(`http://x${ogImageUrl({ title: long })}`).searchParams);
    expect(title.length).toBeLessThanOrEqual(120);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toMatch(/\s…$/); // no dangling space before the ellipsis
  });

  it("collapses newlines, which satori would otherwise render literally", () => {
    const { title } = readOgParams(
      new URL(`http://x${ogImageUrl({ title: "Line one\n\n  line two" })}`).searchParams
    );
    expect(title).toBe("Line one line two");
  });
});

describe("shareMetadata", () => {
  it("suffixes the document title but keeps og:/twitter: titles clean", () => {
    const meta = shareMetadata({ title: "Senior ESG Analyst", path: "/jobs/x-3f8a1c2e9d", badge: "ESG Job" });
    expect(meta.title).toBe("Senior ESG Analyst — Green Mentor Pro");
    expect(meta.openGraph?.title).toBe("Senior ESG Analyst");
    expect(meta.twitter?.title).toBe("Senior ESG Analyst");
  });

  it("uses the item's own artwork when it has some", () => {
    const meta = shareMetadata({
      title: "GHG Lead Verifier",
      path: "/webinars/x-3f8a1c2e9d",
      image: "https://cdn.example.com/cover.png",
      badge: "Webinar",
    });
    expect(meta.openGraph?.images).toEqual(["https://cdn.example.com/cover.png"]);
  });

  it("falls back to the generated card so no link previews imageless", () => {
    const meta = shareMetadata({ title: "Senior ESG Analyst", path: "/jobs/x-3f8a1c2e9d", badge: "ESG Job" });
    // Relative on purpose — metadataBase in app/layout.tsx makes it absolute.
    expect(meta.openGraph?.images).toEqual([expect.stringMatching(/^\/api\/og\?/)]);
  });

  it("sets a canonical so a stale-slug hit doesn't fragment the page's identity", () => {
    const meta = shareMetadata({ title: "x", path: "/feed/x-3f8a1c2e9d", badge: "News" });
    expect(meta.alternates?.canonical).toBe("/feed/x-3f8a1c2e9d");
  });

  it("marks feed posts as articles and carries the publish time", () => {
    const meta = shareMetadata({
      title: "x",
      path: "/feed/x-3f8a1c2e9d",
      badge: "ESG Today",
      type: "article",
      publishedTime: "2026-07-01T00:00:00.000Z",
    });
    expect(meta.openGraph).toMatchObject({ type: "article", publishedTime: "2026-07-01T00:00:00.000Z" });
  });
});
