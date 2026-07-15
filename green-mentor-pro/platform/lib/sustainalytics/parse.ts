/**
 * Deterministic, dependency-free parsers for Sustainalytics' Material ESG Issues
 * (MEI) Resource Center. Two sources, both public:
 *
 *   • the resource-center HTML page — carries the MEI *catalog*: 22 cards, each
 *     with a display name + one-line description (parseMeiCatalog).
 *   • a backend JSON the page fetches — the subindustry → applicable-MEI *matrix*
 *     keyed by ~138 subindustries (parseSubindustryMatrix).
 *
 * The JSON's PascalCase MEI codes (e.g. "Carbon-OwnOperations") are the
 * authoritative join key. The HTML cards don't expose that code cleanly (their
 * CSS class drops "and", e.g. `EmissionsEffluentsWaste`), so we re-derive the
 * code from each card's display name with meiCodeFromName — verified to
 * reproduce all 22 JSON codes exactly. scrape-sustainalytics.ts cross-checks the
 * two code sets at runtime and fails loudly if they ever diverge (page redesign).
 *
 * Pure functions only, no I/O — mirrors lib/brsr/xbrl.ts. Fetching lives in the
 * script.
 */

// ── source URLs ────────────────────────────────────────────────────────────
const ORIGIN = "https://www.sustainalytics.com";
export const SUSTAINALYTICS_SOURCES = {
  /** The resource-center page — MEI catalog (card HTML). */
  page: `${ORIGIN}/material-esg-issues-resource-center`,
  /** Backend JSON the page fetches — subindustry → MEI matrix. */
  matrixJson: `${ORIGIN}/docs/default-source/backend/subindustry-meis.json`,
  /** "Definitions of MEIs" reference PDF linked from the page. */
  definitionsPdf: `${ORIGIN}/docs/default-source/meis/definitionsofmeis.pdf?sfvrsn=8e7552c0_9`,
} as const;

// ── types ──────────────────────────────────────────────────────────────────
export interface MeiCatalogEntry {
  /** Canonical code, e.g. "Carbon-OwnOperations" — matches the matrix JSON. */
  code: string;
  /** Display name, e.g. "Carbon – Own Operations". */
  name: string;
  /** One-line description from the card. */
  description: string;
  /** Order of appearance on the page (0-based). */
  sortOrd: number;
}

export interface SubindustryMei {
  /** Stable JSON key, e.g. "AerospaceandDefence". */
  slug: string;
  /** Display name, e.g. "Aerospace and Defence". */
  name: string;
  /** Applicable MEI codes for this subindustry. */
  meiCodes: string[];
}

// ── HTML entity decoding (the handful the page actually uses) ───────────────
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body] ?? whole;
  });
}

/**
 * Derive the canonical MEI code from a display name, reproducing Sustainalytics'
 * own scheme: normalize en/em dashes to a hyphen, drop spaces around hyphens,
 * then strip everything that isn't [A-Za-z0-9-] (so spaces, commas and "&" all
 * vanish — e.g. "E&S Impact of Products and Services" → "ESImpactofProductsandServices").
 */
export function meiCodeFromName(name: string): string {
  return decodeEntities(name)
    .replace(/[–—]/g, "-") // – — → -
    .replace(/\s*-\s*/g, "-")
    .replace(/[^A-Za-z0-9-]/g, "");
}

/**
 * Parse the 22 MEI cards from the resource-center page HTML. Each card is a
 * `col-* CODE` column div holding a `card-text` description and a
 * `sust-mei-title` name. Throws if no cards are found (page redesign → fail
 * loud rather than store nothing).
 */
export function parseMeiCatalog(html: string): MeiCatalogEntry[] {
  const cardRe =
    /class="col-\d[^"]*"\s*>([\s\S]*?)<p class="sust-mei-title">([^<]+)<\/p>/g;
  const descRe = /class="card-text">([\s\S]*?)<\/p>/;

  const entries: MeiCatalogEntry[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  let ord = 0;
  while ((m = cardRe.exec(html)) !== null) {
    const block = m[1];
    const name = decodeEntities(m[2].trim());
    const descMatch = descRe.exec(block);
    // A `col-*` div without a card-text body isn't an MEI card — skip it.
    if (!descMatch) continue;
    const code = meiCodeFromName(name);
    if (seen.has(code)) continue;
    seen.add(code);
    entries.push({
      code,
      name,
      description: decodeEntities(descMatch[1].trim()),
      sortOrd: ord++,
    });
  }

  if (entries.length === 0) {
    throw new Error(
      "parseMeiCatalog: no MEI cards found — the resource-center page layout likely changed.",
    );
  }
  return entries;
}

/**
 * Parse the subindustry → MEI matrix from the backend JSON, which is an object
 * keyed by subindustry slug: `{ [slug]: { name, meis: string[] } }`. Returns
 * entries sorted by display name. Throws on a shape it doesn't recognize.
 */
export function parseSubindustryMatrix(raw: unknown): SubindustryMei[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("parseSubindustryMatrix: expected a JSON object keyed by subindustry slug.");
  }
  const out: SubindustryMei[] = [];
  for (const [slug, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const v = value as { name?: unknown; meis?: unknown };
    const name = typeof v.name === "string" ? v.name : slug;
    const meiCodes = Array.isArray(v.meis)
      ? v.meis.filter((x): x is string => typeof x === "string")
      : [];
    out.push({ slug, name, meiCodes });
  }
  if (out.length === 0) {
    throw new Error("parseSubindustryMatrix: no subindustries found in the JSON.");
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
