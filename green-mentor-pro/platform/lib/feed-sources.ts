// ESG / sustainability / regulatory RSS sources for the Open Global ESG Feed.
// Each must be an RSS/Atom feed the outlet publishes for syndication (not scraped).
// Verify URLs before relying on them — feeds move. Add BRSR/SEC/CSRD press feeds
// as you find clean ones.
export type RssSource = {
  id: string; // stable slug, also the article `source`
  publisher: string;
  feedUrl: string;
};

export const RSS_SOURCES: RssSource[] = [
  { id: "esg-today", publisher: "ESG Today", feedUrl: "https://www.esgtoday.com/feed/" },
  { id: "greenbiz", publisher: "GreenBiz", feedUrl: "https://www.greenbiz.com/rss.xml" },
  { id: "edie", publisher: "edie", feedUrl: "https://www.edie.net/feed/" },
  { id: "carbon-brief", publisher: "Carbon Brief", feedUrl: "https://www.carbonbrief.org/feed/" },
];

// Controlled vocabulary the summarizer tags against. The worker upserts any new
// slugs the model returns, but steering it to these keeps the follow-graph clean.
export const KNOWN_ENTITIES: { slug: string; name: string; kind: "framework" | "topic" | "region" | "company" }[] = [
  { slug: "brsr", name: "BRSR", kind: "framework" },
  { slug: "csrd", name: "CSRD / ESRS", kind: "framework" },
  { slug: "sec-climate", name: "SEC Climate Rule", kind: "framework" },
  { slug: "ghg-protocol", name: "GHG Protocol", kind: "framework" },
  { slug: "issb", name: "ISSB / IFRS S1-S2", kind: "framework" },
  { slug: "tcfd", name: "TCFD", kind: "framework" },
  { slug: "gri", name: "GRI", kind: "framework" },
  { slug: "scope-3", name: "Scope 3 emissions", kind: "topic" },
  { slug: "materiality", name: "Double materiality", kind: "topic" },
  { slug: "assurance", name: "Assurance", kind: "topic" },
  { slug: "biodiversity", name: "Biodiversity / nature", kind: "topic" },
  { slug: "india", name: "India", kind: "region" },
  { slug: "eu", name: "European Union", kind: "region" },
  { slug: "us", name: "United States", kind: "region" },
];
