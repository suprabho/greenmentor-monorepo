/**
 * Deterministic, dependency-free parsers for the SASB Materiality Finder
 * (navigator.sasb.ifrs.org). The single-page app is backed by a public,
 * unauthenticated AWS API Gateway (its `unprotectedAPIClient`); three JSON
 * endpoints together carry the whole materiality map:
 *
 *   • /sectorIndustry            — the SICS taxonomy: 11 sectors → 77 industries
 *                                  (parseSectorIndustry).
 *   • /sustainability-dimensions — the 5 dimensions → 26 General Issue Categories,
 *                                  the canonical name/dimension/description for each
 *                                  GIC (parseDimensions).
 *   • /industryTopics?industries=<codes>&locale=en
 *                                — per industry, the GICs *material* to it and, under
 *                                  each, the industry-specific disclosure topics. The
 *                                  presence of a GIC here == "material to this
 *                                  industry" — this is the value of the map
 *                                  (parseIndustryTopics).
 *
 * The GIC code (e.g. 110) is the authoritative join key between the last two
 * endpoints; it arrives as an int and is normalized to text (like Sustainalytics'
 * MEI `code`). Every `topic_code` (e.g. "CG-AA-250a") embeds its industry + GIC.
 * scrape-sasb.ts cross-checks the three responses at runtime and fails loudly if
 * they diverge (an API redesign) rather than storing a half-broken taxonomy.
 *
 * Pure functions only, no I/O — mirrors lib/sustainalytics/parse.ts. Fetching
 * lives in the script.
 */

// ── source URLs ──────────────────────────────────────────────────────────────
const ORIGIN = "https://owaeaasu09.execute-api.us-west-2.amazonaws.com/prod/navigator-data";
export const SASB_SOURCES = {
  origin: ORIGIN,
  /** SICS sector → industry taxonomy. */
  sectorIndustry: `${ORIGIN}/sectorIndustry`,
  /** Dimensions → the 26 General Issue Categories (canonical GIC metadata). */
  dimensions: `${ORIGIN}/sustainability-dimensions`,
  /** Per-industry material GICs + disclosure topics. Batched — all codes at once. */
  industryTopics: (codes: readonly string[], locale = "en"): string =>
    `${ORIGIN}/industryTopics?industries=${codes.join(",")}&locale=${locale}`,
} as const;

// ── types ────────────────────────────────────────────────────────────────────
export interface SasbIndustry {
  /** SICS industry code, e.g. "CG-AA" (the join key). */
  code: string;
  /** Display name, e.g. "Apparel, Accessories & Footwear". */
  name: string;
  /** Parent SICS sector, e.g. "Consumer Goods". */
  sector: string;
  /** Industry description paragraph. */
  description: string;
}

export interface SasbIssueCategory {
  /** Stringified GIC code, e.g. "110" (matches industryTopics' gic_code). */
  code: string;
  /** Display name, e.g. "GHG Emissions". */
  name: string;
  /** One of the 5 dimensions, e.g. "Environment". */
  dimension: string;
  /** Category description paragraph. */
  description: string;
  /** 0-based order across dimensions — the canonical SASB ordering. */
  sortOrd: number;
}

export interface SasbTopic {
  /** Disclosure-topic code, e.g. "CG-AA-250a" (industry + GIC + letter). */
  code: string;
  /** Topic name, e.g. "Management of Chemicals in Products". */
  name: string;
  /** Topic description paragraph. */
  description: string;
}

export interface SasbIndustryGic {
  /** The material General Issue Category for this industry, e.g. "250". */
  gicCode: string;
  /** Dimension as reported by industryTopics (cross-checked against dimensions). */
  dimension: string;
  /** Industry-specific disclosure topics under this industry×GIC. */
  topics: SasbTopic[];
}

export interface SasbIndustryTopics {
  /** SICS industry code, e.g. "CG-AA". */
  industryCode: string;
  /** GICs material to this industry, each with its disclosure topics. */
  gics: SasbIndustryGic[];
}

// ── helpers ──────────────────────────────────────────────────────────────────
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
/** GIC codes arrive as ints; disclosure/industry codes as strings. Normalize to text. */
const code = (v: unknown): string | null =>
  typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : null;

// ── parsers ──────────────────────────────────────────────────────────────────

/**
 * Flatten the /sectorIndustry response (`[{ sector, industries:[{ code, name,
 * description }] }]`) into a flat, code-sorted industry list carrying the parent
 * sector name. Throws if the shape yields no industries (API redesign → fail loud).
 */
export function parseSectorIndustry(raw: unknown): SasbIndustry[] {
  if (!Array.isArray(raw)) {
    throw new Error("parseSectorIndustry: expected an array of sectors.");
  }
  const out: SasbIndustry[] = [];
  for (const s of raw) {
    if (!isObj(s) || typeof s.sector !== "string" || !Array.isArray(s.industries)) continue;
    for (const i of s.industries) {
      if (!isObj(i) || typeof i.code !== "string" || typeof i.name !== "string") continue;
      out.push({ code: i.code, name: i.name, sector: s.sector, description: str(i.description) });
    }
  }
  if (out.length === 0) {
    throw new Error("parseSectorIndustry: no industries found — the sectorIndustry response shape likely changed.");
  }
  out.sort((a, b) => a.code.localeCompare(b.code));
  return out;
}

/**
 * Flatten the /sustainability-dimensions response (`[{ name, issueCategories:[{
 * code, name, description }] }]`) into the 26 General Issue Categories, preserving
 * the canonical dimension→category order as sortOrd. Throws on an empty result.
 */
export function parseDimensions(raw: unknown): SasbIssueCategory[] {
  if (!Array.isArray(raw)) {
    throw new Error("parseDimensions: expected an array of dimensions.");
  }
  const out: SasbIssueCategory[] = [];
  let ord = 0;
  for (const d of raw) {
    if (!isObj(d) || typeof d.name !== "string" || !Array.isArray(d.issueCategories)) continue;
    for (const c of d.issueCategories) {
      if (!isObj(c)) continue;
      const gic = code(c.code);
      if (gic === null || typeof c.name !== "string") continue;
      out.push({
        code: gic,
        name: c.name,
        dimension: d.name,
        description: str(c.description),
        sortOrd: ord++,
      });
    }
  }
  if (out.length === 0) {
    throw new Error("parseDimensions: no issue categories found — the sustainability-dimensions response shape likely changed.");
  }
  return out;
}

/**
 * Parse the /industryTopics response (`[{ industry_code, industry_gics:[{ gic_code,
 * gic_dimension, gic_topics:[{ topic_code, topic_name, topic_description }] }] }]`)
 * into a normalized, deterministically-sorted per-industry structure. GIC codes are
 * stringified. Throws if no industries are found.
 */
export function parseIndustryTopics(raw: unknown): SasbIndustryTopics[] {
  if (!Array.isArray(raw)) {
    throw new Error("parseIndustryTopics: expected an array of industries.");
  }
  const out: SasbIndustryTopics[] = [];
  for (const x of raw) {
    if (!isObj(x) || typeof x.industry_code !== "string" || !Array.isArray(x.industry_gics)) continue;
    const gics: SasbIndustryGic[] = [];
    for (const g of x.industry_gics) {
      if (!isObj(g)) continue;
      const gicCode = code(g.gic_code);
      if (gicCode === null) continue;
      const topics: SasbTopic[] = [];
      if (Array.isArray(g.gic_topics)) {
        for (const t of g.gic_topics) {
          if (!isObj(t) || typeof t.topic_code !== "string" || typeof t.topic_name !== "string") continue;
          topics.push({ code: t.topic_code, name: t.topic_name, description: str(t.topic_description) });
        }
        topics.sort((a, b) => a.code.localeCompare(b.code));
      }
      gics.push({ gicCode, dimension: str(g.gic_dimension), topics });
    }
    gics.sort((a, b) => a.gicCode.localeCompare(b.gicCode));
    out.push({ industryCode: x.industry_code, gics });
  }
  if (out.length === 0) {
    throw new Error("parseIndustryTopics: no industries found — the industryTopics response shape likely changed.");
  }
  out.sort((a, b) => a.industryCode.localeCompare(b.industryCode));
  return out;
}
