// ESG / sustainability / regulatory RSS sources for the ESG news feed.
// Each must be an RSS/Atom feed the outlet publishes for syndication (not scraped).
//
// Verify URLs before relying on them — feeds move, and they fail *silently*:
// a dead feed that 200s with an HTML page just parses to zero items and the
// worker reports "0 new" every night forever. That is exactly how the original
// GreenBiz entry rotted (greenbiz.com/rss.xml now serves the trellis.net
// homepage after the rebrand). Run `pnpm feed:check` to catch that early.
//
// Known-unreachable, do not re-add without re-testing:
//   - Business Standard — hard 403 "Access Denied" (Akamai bot block) on every
//     /rss/ path, with both the worker UA and a full desktop Chrome UA.
//   - MCA (mca.gov.in) — 403, publishes no RSS feed at all.
//   - PIB (pib.gov.in/RssMain.aspx) — serves Hindi-only content at every
//     Lang/Regid combination tried; no reachable English feed. SEBI and ET
//     Government cover the Indian regulatory beat instead.
export type RssSource = {
  id: string; // stable slug, also the article `source`
  publisher: string;
  feedUrl: string;
  /** Drives articles.region, which biases feed ordering — see lib/feed/rank.ts. */
  region: "india" | "global";
  /**
   * Set on broad or non-ESG feeds (regulators, general business desks). Items
   * must hit ESG_KEYWORDS before we spend a summarizer call on them; the
   * model's own `relevant` gate still runs on whatever survives.
   */
  strict?: boolean;
};

export const RSS_SOURCES: RssSource[] = [
  // India — these lead the feed (lib/feed/rank.ts).
  { id: "et-environment", publisher: "Economic Times", region: "india", feedUrl: "https://economictimes.indiatimes.com/news/environment/rssfeeds/2647163.cms" },
  { id: "et-energy", publisher: "Economic Times", region: "india", feedUrl: "https://economictimes.indiatimes.com/industry/energy/rssfeeds/13358350.cms" },
  { id: "et-energyworld", publisher: "ETEnergyWorld", region: "india", feedUrl: "https://energy.economictimes.indiatimes.com/rss/renewable" },
  { id: "et-government", publisher: "ET Government", region: "india", strict: true, feedUrl: "https://government.economictimes.indiatimes.com/rss/topstories" },
  { id: "the-hindu-env", publisher: "The Hindu", region: "india", feedUrl: "https://www.thehindu.com/sci-tech/energy-and-environment/feeder/default.rss" },
  { id: "hindu-businessline", publisher: "The Hindu BusinessLine", region: "india", strict: true, feedUrl: "https://www.thehindubusinessline.com/economy/feeder/default.rss" },
  { id: "mint-industry", publisher: "Mint", region: "india", strict: true, feedUrl: "https://www.livemint.com/rss/industry" },
  { id: "mongabay-india", publisher: "Mongabay India", region: "india", feedUrl: "https://india.mongabay.com/feed/" },
  // SEBI publishes every enforcement order to one feed, so the vast majority is
  // off-topic — hence `strict`. It also carries no images at all; those cards
  // get their picture from the admin News panel or fall back to the gradient.
  { id: "sebi", publisher: "SEBI", region: "india", strict: true, feedUrl: "https://www.sebi.gov.in/sebirss.xml" },

  // Global
  { id: "esg-today", publisher: "ESG Today", region: "global", feedUrl: "https://www.esgtoday.com/feed/" },
  { id: "trellis", publisher: "Trellis", region: "global", feedUrl: "https://trellis.net/feed/" },
  { id: "edie", publisher: "edie", region: "global", feedUrl: "https://www.edie.net/feed/" },
  { id: "carbon-brief", publisher: "Carbon Brief", region: "global", feedUrl: "https://www.carbonbrief.org/feed/" },
];

/**
 * Cheap relevance gate for `strict` sources, applied to title + excerpt before
 * the summarizer runs. Deliberately generous — it only has to reject the
 * obvious noise (SEBI settlement orders, general market copy) so we don't pay
 * for a model call on every item of a 30-item regulatory feed.
 */
export const ESG_KEYWORDS = [
  "esg", "brsr", "sustainab", "climate", "carbon", "emission", "net zero", "net-zero",
  "renewable", "solar", "wind power", "green hydrogen", "circular economy", "biodiversity",
  "pollution", "decarbon", "energy transition", "environment", "greenwash",
  "business responsibility", "social stock exchange", "csr", "csrd", "issb", "tcfd", "gri",
];

export function looksEsgRelevant(text: string): boolean {
  const haystack = text.toLowerCase();
  return ESG_KEYWORDS.some((k) => haystack.includes(k));
}

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
