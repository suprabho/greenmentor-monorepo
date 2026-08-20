/**
 * Deterministic XBRL fact extractor for NSE BRSR filings.
 *
 * BRSR XBRL instances use SEBI's cap-market taxonomy (in-capmkt: namespace,
 * ~430 unique element names per filing) with self-describing tag names like
 * TotalScope1Emissions. That makes extraction a pure text problem — no LLM,
 * and, matching the repo's zero-dependency XML style (parseFeed in
 * scripts/ingest-feed.ts), no XML library: regex over leaf elements.
 *
 * The matcher joins extracted facts against the curated map in tag-map.ts.
 * Whole-entity figures (emissions, energy, water, waste) live in
 * non-dimensional contexts; safety/attrition figures only exist behind
 * employee-class dimension members, so defs opt into those via `members`
 * (see tag-map.ts). Everything else dimensional is dropped in v1 — the
 * archived XBRL retains it for later.
 */

import { BRSR_TAG_MAP, type BrsrIndicatorDef } from "./tag-map";

/** Structural XBRL namespaces — never data facts. */
const STRUCTURAL_PREFIXES = new Set(["xbrli", "link", "xlink", "xbrldi", "iso4217", "xsi", "xml", "xmlns"]);

export type XbrlFact = {
  tag: string; // local name, e.g. "TotalScope1Emissions"
  contextRef: string;
  unitRef: string | null;
  value: string;
};

export type XbrlContext = {
  id: string;
  periodStart: string | null; // "2025-04-01" (also set from <instant>)
  periodEnd: string | null;
  /** Explicit dimension members (local names, sorted), e.g. ["EmployeesMember"].
   * Empty for whole-entity contexts like DCYMain. */
  members: string[];
};

export type MatchedIndicator = {
  key: string;
  rawTag: string;
  contextRef: string;
  periodStart: string | null;
  periodEnd: string | null;
  unit: string | null;
  value: number;
};

export type Coverage = {
  matchedKeys: string[];
  missingKeys: string[];
  contexts: number;
};

const attr = (attrs: string, name: string): string | null => {
  const m = attrs.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
};

/** All prefixed leaf elements that aren't structural XBRL plumbing. */
export function extractFacts(xml: string): XbrlFact[] {
  const facts: XbrlFact[] = [];
  // Leaf element: value contains no '<'; closing tag must match. Attribute
  // order varies between filers, so attrs are parsed separately.
  const re = /<([A-Za-z][\w.-]*):([A-Za-z][\w.-]*)((?:\s[^<>]*?)?)>([^<]*)<\/\1:\2>/g;
  for (const m of xml.matchAll(re)) {
    const [, prefix, tag, attrs, value] = m;
    if (STRUCTURAL_PREFIXES.has(prefix)) continue;
    if (tag.endsWith("TextBlock")) continue; // narrative blocks — not numeric facts
    const contextRef = attr(attrs, "contextRef");
    if (!contextRef) continue;
    facts.push({ tag, contextRef, unitRef: attr(attrs, "unitRef"), value: value.trim() });
  }
  return facts;
}

/** Parse <xbrli:context> definitions so facts resolve to concrete periods. */
export function extractContexts(xml: string): Map<string, XbrlContext> {
  const contexts = new Map<string, XbrlContext>();
  const re = /<(?:\w+:)?context\s[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?context>/g;
  for (const m of xml.matchAll(re)) {
    const [, id, body] = m;
    const pick = (tag: string): string | null => {
      const t = body.match(new RegExp(`<(?:\\w+:)?${tag}>([^<]*)<`));
      return t ? t[1].trim() : null;
    };
    const instant = pick("instant");
    const members = [...body.matchAll(/<(?:\w+:)?explicitMember[^>]*>([^<]*)</g)]
      // "in-capmkt:EmployeesMember" → "EmployeesMember" (prefixes can contain hyphens)
      .map((mm) => mm[1].trim().replace(/^[^:]*:/, ""))
      .sort();
    contexts.set(id, {
      id,
      periodStart: pick("startDate") ?? instant,
      periodEnd: pick("endDate") ?? instant,
      members,
    });
  }
  return contexts;
}

/** Tolerant numeric coercion; null (→ fact dropped) for "-", "NA", text, etc. */
export function toNumber(value: string): number | null {
  const cleaned = value.replace(/[,\s]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** A def matches a context when their member sets are identical — whole-entity
 * defs (no members) require a whole-entity context, member-filtered defs (e.g.
 * safety per employee class) require exactly that member set. */
function membersMatch(def: BrsrIndicatorDef, context: XbrlContext): boolean {
  const want = [...(def.members ?? [])].sort();
  return want.length === context.members.length && want.every((m, i) => m === context.members[i]);
}

/** Join facts against the curated tag map. First matching fact wins per (key, context). */
export function matchIndicators(
  facts: XbrlFact[],
  contexts: Map<string, XbrlContext>,
  defs: BrsrIndicatorDef[] = BRSR_TAG_MAP,
): { indicators: MatchedIndicator[]; coverage: Coverage } {
  // One tag can back several keys (member-filtered variants), so map to lists.
  const defsByTag = new Map<string, BrsrIndicatorDef[]>();
  for (const def of defs) {
    for (const tag of def.tags) {
      const list = defsByTag.get(tag);
      if (list) list.push(def);
      else defsByTag.set(tag, [def]);
    }
  }

  const byKeyContext = new Map<string, MatchedIndicator>();
  for (const fact of facts) {
    const candidates = defsByTag.get(fact.tag);
    if (!candidates) continue;
    const context = contexts.get(fact.contextRef);
    if (!context) continue;
    const value = toNumber(fact.value);
    if (value === null) continue;
    for (const def of candidates) {
      if (!membersMatch(def, context)) continue;
      const slot = `${def.key} ${fact.contextRef}`;
      if (byKeyContext.has(slot)) continue;
      byKeyContext.set(slot, {
        key: def.key,
        rawTag: fact.tag,
        contextRef: fact.contextRef,
        periodStart: context.periodStart,
        periodEnd: context.periodEnd,
        unit: fact.unitRef,
        value,
      });
    }
  }

  // Fallback pass for defs declaring fallbackTags. Such a def is a non-negative
  // magnitude, so a filed value <= 0 means "this concept does not apply to us"
  // rather than a real measurement — banks and insurers file Turnover as 0, and
  // IDEA FY2024-25 filed a negative — so a substitutable element stands in. Kept
  // deliberately narrow: replace a zero in the SAME context, or seed a key that is
  // absent from the whole filing. Without that second restriction, a fallback
  // present in prior-year contexts would mint extra period rows on every filing
  // whose primary tag is already healthy.
  const fallbackByTag = new Map<string, BrsrIndicatorDef[]>();
  for (const def of defs) {
    for (const tag of def.fallbackTags ?? []) {
      const list = fallbackByTag.get(tag);
      if (list) list.push(def);
      else fallbackByTag.set(tag, [def]);
    }
  }
  if (fallbackByTag.size) {
    type Candidate = { def: BrsrIndicatorDef; fact: XbrlFact; context: XbrlContext; value: number };
    const candidates: Candidate[] = [];
    for (const fact of facts) {
      const defsForTag = fallbackByTag.get(fact.tag);
      if (!defsForTag) continue;
      const context = contexts.get(fact.contextRef);
      if (!context) continue;
      const value = toNumber(fact.value);
      if (value === null || value <= 0) continue; // an unusable fallback rescues nothing
      for (const def of defsForTag) {
        if (!membersMatch(def, context)) continue;
        candidates.push({ def, fact, context, value });
      }
    }

    const entryOf = (c: Candidate): MatchedIndicator => ({
      key: c.def.key,
      rawTag: c.fact.tag, // audit trail: brsr_indicators.raw_tag shows the substitute
      contextRef: c.fact.contextRef,
      periodStart: c.context.periodStart,
      periodEnd: c.context.periodEnd,
      unit: c.fact.unitRef,
      value: c.value,
    });

    // (a) swap out an unusable filed value, first candidate wins
    for (const c of candidates) {
      const slot = `${c.def.key} ${c.fact.contextRef}`;
      const existing = byKeyContext.get(slot);
      if (existing && existing.value <= 0) byKeyContext.set(slot, entryOf(c));
    }

    // (b) key still has no real value anywhere → seed only its latest period
    const haveValue = new Set([...byKeyContext.values()].filter((i) => i.value > 0).map((i) => i.key));
    const orphaned = new Map<string, Candidate[]>();
    for (const c of candidates) {
      if (haveValue.has(c.def.key)) continue;
      const list = orphaned.get(c.def.key);
      if (list) list.push(c);
      else orphaned.set(c.def.key, [c]);
    }
    for (const [key, list] of orphaned) {
      const latest = list.reduce((a, b) =>
        String(b.context.periodEnd ?? "") > String(a.context.periodEnd ?? "") ? b : a,
      );
      byKeyContext.set(`${key} ${latest.fact.contextRef}`, entryOf(latest));
    }
  }

  const indicators = [...byKeyContext.values()];
  const matched = new Set(indicators.map((i) => i.key));
  return {
    indicators,
    coverage: {
      matchedKeys: [...matched],
      missingKeys: defs.map((d) => d.key).filter((k) => !matched.has(k)),
      contexts: new Set(indicators.map((i) => i.contextRef)).size,
    },
  };
}

// ---------------------------------------------------------------------------
// Material topics (BRSR Section A "material responsible business conduct issues")

export type MaterialTopic = {
  contextRef: string;
  rowOrd: number | null; // typed-member row number; null when unparseable
  topicRaw: string; // decoded MaterialIssueIdentified, <=600 chars
  riskOpportunity: "R" | "O" | "RO" | null;
  rationale: string | null; // <=2000 chars each
  approach: string | null;
  financialImplications: string | null;
};

/**
 * Named + numeric XML entities (ingest-feed's decode() lacks the numeric forms),
 * then a scrub of the characters Postgres refuses to store.
 *
 * Some filings carry encoding damage in their narrative blocks: LICI 2021-22 has
 * a raw NUL followed by U+0019 where a smart apostrophe belongs, the wreckage of
 * a mis-transcoded U+2019. Postgres accepts neither a NUL nor an unpaired
 * surrogate in text or jsonb -- it rejects the whole row with "unsupported
 * Unicode escape sequence", so a single bad glyph fails an entire filing. Scrub
 * after decoding, which is also the step that would turn &#0; into a NUL in the
 * first place. Tab/newline/CR survive; every caller collapses whitespace anyway.
 */
export function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    // C0 controls except \t (\u0009), \n (\u000A), \r (\u000D)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    // lone halves of a surrogate pair, which are not valid UTF-8 either
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

/** The canon join key: decoded, lowercased, whitespace-squeezed. */
export function normalizeTopic(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Exact-match lookup after decode → uppercase → strip non-letters. Substring
 * tests are wrong here ("OPPORTUNITY" contains "R"); unknown values → null. */
const RISK_OPPORTUNITY: Record<string, "R" | "O" | "RO"> = {
  R: "R",
  RISK: "R",
  RISKS: "R",
  O: "O",
  OPPORTUNITY: "O",
  OPPORTUNITIES: "O",
  RO: "RO",
  RANDO: "RO",
  OANDR: "RO",
  BOTH: "RO",
  RISKOPPORTUNITY: "RO",
  RISKANDOPPORTUNITY: "RO",
  RISKSANDOPPORTUNITIES: "RO",
  OPPORTUNITYANDRISK: "RO",
  RISKASWELLASOPPORTUNITY: "RO",
};

function normalizeRiskOpportunity(value: string | undefined): "R" | "O" | "RO" | null {
  if (!value) return null;
  const key = decodeXmlEntities(value).toUpperCase().replace(/[^A-Z]/g, "");
  return RISK_OPPORTUNITY[key] ?? null;
}

const cleanText = (value: string | undefined, cap: number): string | null => {
  if (!value) return null;
  const decoded = decodeXmlEntities(value).replace(/\s+/g, " ").trim();
  return decoded ? decoded.slice(0, cap) : null;
};

/**
 * Extract the material-issues table. Detection is fact-first: any context
 * carrying a MaterialIssueIdentified fact IS an issue row — robust to axis
 * naming drift and independent of typed-dimension parsing (extractContexts
 * deliberately ignores typedMember; changing its members would break stage 3's
 * whole-entity matching). The typed member only supplies the row number.
 */
export function extractMaterialTopics(xml: string): MaterialTopic[] {
  const byContext = new Map<string, Record<string, string>>();
  for (const fact of extractFacts(xml)) {
    let entry = byContext.get(fact.contextRef);
    if (!entry) byContext.set(fact.contextRef, (entry = {}));
    if (!(fact.tag in entry)) entry[fact.tag] = fact.value;
  }

  // contextRef → typed-member row number, from the raw context bodies
  const rowOrds = new Map<string, number>();
  const contextRe = /<(?:\w+:)?context\s[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?context>/g;
  for (const m of xml.matchAll(contextRe)) {
    const typed = m[2].match(
      /<(?:[\w.-]+:)?typedMember[^>]*dimension="[^"]*MaterialResponsibleBusinessConductIssues[^"]*"[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?typedMember>/,
    );
    if (!typed) continue;
    // Member value is "<domain-element>…Domain12</domain-element>" — the row
    // number is the trailing digit run of the inner text.
    const ord = typed[1].match(/(\d+)\s*<\//) ?? typed[1].match(/(\d+)\s*$/);
    if (ord) rowOrds.set(m[1], Number(ord[1]));
  }

  const topics: MaterialTopic[] = [];
  for (const [contextRef, facts] of byContext) {
    if (!("MaterialIssueIdentified" in facts)) continue;
    const topicRaw = cleanText(facts.MaterialIssueIdentified, 600);
    if (!topicRaw) continue; // empty topic name → not a usable row
    // Junk placeholders some filers put in the table ("NA", "Nil", "-", a lone
    // character) — not material topics, drop the row.
    if (/^(?:na|n\.?a\.?|nil|none|nan|not applicable|-{1,3}|\W{1,2}|.)$/i.test(normalizeTopic(topicRaw))) continue;
    topics.push({
      contextRef,
      rowOrd: rowOrds.get(contextRef) ?? null,
      topicRaw,
      riskOpportunity: normalizeRiskOpportunity(facts.IndicateWhetherRiskOrOpportunity),
      rationale: cleanText(facts.RationaleForIdentifyingTheRiskOpportunity, 2000),
      approach: cleanText(facts.InCaseOfRiskApproachToAdaptOrMitigate, 2000),
      financialImplications: cleanText(facts.FinancialImplicationsOfTheRiskOrOpportunity, 2000),
    });
  }
  return topics.sort(
    (a, b) => (a.rowOrd ?? Infinity) - (b.rowOrd ?? Infinity) || a.contextRef.localeCompare(b.contextRef),
  );
}

// ---------------------------------------------------------------------------
// Company profile — BRSR Section A identity block (contact + legal identity)

export type CompanyProfile = {
  legalName: string | null; // as filed, e.g. "Yatra Online Limited" (may differ from the NSE index name)
  cin: string | null; // Corporate Identity Number, e.g. "L63040MH2005PLC158404"
  email: string | null;
  telephone: string | null; // free-form, e.g. "0884-2383904" — kept verbatim, not normalized
  website: string | null;
};

// in-capmkt local names for the identity/contact fields. Company-level fields
// sit in the whole-entity current-year context (DCYMain/ICYMain); we take the
// first non-empty value per tag, which is unambiguous since identity facts are
// reported once (no per-period or dimensional variants).
const PROFILE_TAGS = {
  legalName: "NameOfTheCompany",
  cin: "CorporateIdentityNumber",
  email: "EMailOfTheCompany",
  telephone: "TelephoneOfCompany",
  website: "WebsiteOfCompany",
} as const;

const cleanContact = (value: string): string | null => {
  const v = decodeXmlEntities(value).replace(/\s+/g, " ").trim();
  // Filers use "-", "NA", "Nil" etc. as null sentinels in text fields too.
  if (!v || /^(?:na|n\.?a\.?|nil|none|not applicable|-{1,3})$/i.test(v)) return null;
  return v.slice(0, 512);
};

/** Extract the Section A contact/identity fields. Missing tags → null. */
export function extractCompanyProfile(xml: string): CompanyProfile {
  const firstByTag = new Map<string, string>();
  for (const fact of extractFacts(xml)) {
    if (!firstByTag.has(fact.tag) && fact.value) firstByTag.set(fact.tag, fact.value);
  }
  const pick = (tag: string): string | null => {
    const raw = firstByTag.get(tag);
    return raw ? cleanContact(raw) : null;
  };
  return {
    legalName: pick(PROFILE_TAGS.legalName),
    cin: pick(PROFILE_TAGS.cin),
    email: pick(PROFILE_TAGS.email),
    telephone: pick(PROFILE_TAGS.telephone),
    website: pick(PROFILE_TAGS.website),
  };
}

// ---------------------------------------------------------------------------
// Products/services turnover split — BRSR Section A, the NIC-coded table that
// backs turnover-weighted sector/industry classification (see nic-sector.ts).

export type ProductTurnover = {
  contextRef: string; // the row's XBRL context, e.g. "D_ProductServiceSold1"
  nicCode: string; // as filed (digits kept verbatim; resolveNic normalizes)
  turnover: number; // share of turnover, as filed (fraction like 0.94 or a percent)
  name: string | null;
};

const PRODUCT_NIC_TAG = "NICCodeOfProductOrServiceSoldByTheEntity";
const PRODUCT_TURNOVER_TAG = "PercentageOfTotalTurnoverForProductOrServiceSold";
const PRODUCT_NAME_TAG = "ProductOrServiceSoldByTheEntity";

/**
 * Extract the "products/services accounting for 90% of turnover" rows. Each row
 * is one dimensional context (D_ProductServiceSold1, …) carrying a NIC code and
 * its turnover share; detection is fact-first (any context with a NIC-code fact
 * is a row), robust to axis-naming drift. Rows without a parseable NIC code or a
 * positive turnover are dropped — they carry no sector signal.
 */
export function extractProductTurnover(xml: string): ProductTurnover[] {
  const byContext = new Map<string, Record<string, string>>();
  for (const fact of extractFacts(xml)) {
    let entry = byContext.get(fact.contextRef);
    if (!entry) byContext.set(fact.contextRef, (entry = {}));
    if (!(fact.tag in entry)) entry[fact.tag] = fact.value;
  }

  const rows: ProductTurnover[] = [];
  for (const [contextRef, facts] of byContext) {
    const nicRaw = facts[PRODUCT_NIC_TAG];
    if (!nicRaw) continue;
    const nicCode = nicRaw.replace(/\D/g, "");
    if (!nicCode) continue;
    const turnover = toNumber(facts[PRODUCT_TURNOVER_TAG] ?? "");
    if (turnover === null || turnover <= 0) continue;
    rows.push({ contextRef, nicCode, turnover, name: cleanContact(facts[PRODUCT_NAME_TAG] ?? "") });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Markets served — BRSR Section A Q20/21: plant/office locations (national vs
// international), number of states/countries served, exports as % of turnover,
// and the free-text customer-types brief.

export type MarketsServed = {
  plantsNational: number | null;
  officesNational: number | null;
  plantsInternational: number | null;
  officesInternational: number | null;
  statesServed: number | null;
  countriesServed: number | null;
  exportsPctTurnover: number | null; // as filed, clamped to 0..100
  customerTypes: string | null;
  /** field → XBRL local name that supplied it — audit trail for tag drift. */
  matchedTags: Record<string, string>;
};

/**
 * Extract the Section A markets-served facts. Unlike the identity block these
 * tags drift across taxonomy years and filers, and the national/international
 * split is modelled two ways in the wild — qualified tag names
 * (NumberOfNationalPlant) or a location dimension on a bare count
 * (NumberOfPlants in a National/International member context). In practice the
 * second form dominates and is fully generic: one NumberOfLocations tag carrying
 * BOTH axes as members (PlantMember + NationalMember), so the plant/office kind
 * has to be read off the context exactly like the scope. Matching is therefore
 * pattern-based over self-describing local names, resolved by tag name first and
 * context member second on each axis, with the winning tag recorded per field.
 * Verify coverage against stored XBRLs with --dump-tags after taxonomy updates.
 */
export function extractMarketsServed(xml: string): MarketsServed {
  const facts = extractFacts(xml);
  const contexts = extractContexts(xml);

  // "national" | "international" from the tag name, else from dimension members.
  const scopeOf = (fact: XbrlFact): "national" | "international" | null => {
    if (/International|OutsideIndia|Overseas/i.test(fact.tag)) return "international";
    if (/National|InIndia|Domestic/i.test(fact.tag)) return "national";
    const members = contexts.get(fact.contextRef)?.members ?? [];
    if (members.some((m) => /International|OutsideIndia|Overseas/i.test(m))) return "international";
    if (members.some((m) => /National|InIndia|Domestic/i.test(m))) return "national";
    return null;
  };

  // "plant" | "office" the same way. A row dimensioned only on LocationMember is
  // the Q20 all-locations total, so it resolves to null and stays out of both the
  // plant and the office field rather than being double-counted into one.
  const kindOf = (fact: XbrlFact): "plant" | "office" | null => {
    if (/Plant|Factory|Manufactur/i.test(fact.tag)) return "plant";
    if (/Office/i.test(fact.tag)) return "office";
    const members = contexts.get(fact.contextRef)?.members ?? [];
    if (members.some((m) => /Plant|Factory|Manufactur/i.test(m))) return "plant";
    if (members.some((m) => /Office/i.test(m))) return "office";
    return null;
  };

  // Among matching numeric facts prefer the most recent period (CY over PY rows).
  const pickLatest = (matches: XbrlFact[]): XbrlFact | null => {
    let best: XbrlFact | null = null;
    let bestEnd = "";
    for (const f of matches) {
      const end = contexts.get(f.contextRef)?.periodEnd ?? "";
      if (!best || end > bestEnd) {
        best = f;
        bestEnd = end;
      }
    }
    return best;
  };

  const matchedTags: Record<string, string> = {};
  const numberField = (
    field: string,
    tagRe: RegExp,
    scope?: "national" | "international",
    kind?: "plant" | "office",
  ): number | null => {
    const matches = facts.filter(
      (f) =>
        tagRe.test(f.tag) &&
        toNumber(f.value) !== null &&
        (!scope || scopeOf(f) === scope) &&
        (!kind || kindOf(f) === kind),
    );
    const fact = pickLatest(matches);
    if (!fact) return null;
    matchedTags[field] = fact.tag;
    return toNumber(fact.value);
  };

  // Q20 — plant/office counts. One pattern admits both the kind-qualified tags
  // (NumberOfNationalPlant) and the generic dimensioned count (NumberOfLocations);
  // kindOf/scopeOf then pick the right cell. Anchoring on NumberOf keeps the
  // Percentage…PlantsAndOfficesThatWereAssessed P3/P5 tags out.
  const LOCATION_COUNT_RE = /^NumberOf\w*(?:Plant|Office|Location|Factory|Site)/i;
  const plantsNational = numberField("plantsNational", LOCATION_COUNT_RE, "national", "plant");
  const officesNational = numberField("officesNational", LOCATION_COUNT_RE, "national", "office");
  const plantsInternational = numberField("plantsInternational", LOCATION_COUNT_RE, "international", "plant");
  const officesInternational = numberField("officesInternational", LOCATION_COUNT_RE, "international", "office");
  const statesServed = numberField("statesServed", /^NumberOf\w*State/i);
  const countriesServed = numberField("countriesServed", /^NumberOf\w*Countr/i);

  // Q21b — "contribution of exports as a percentage of the total turnover".
  // Filed value conventions vary (0.35 vs 35); stored as filed, clamped 0..100.
  let exportsPctTurnover = numberField("exportsPctTurnover", /Export.*(Percentage|Turnover)|(Percentage|Contribution).*Export/i);
  if (exportsPctTurnover !== null && (exportsPctTurnover < 0 || exportsPctTurnover > 100)) exportsPctTurnover = null;

  // Q21c — customer-types brief. Usually a TextBlock, which extractFacts skips,
  // so search the raw XML for any customer-types element and strip its markup.
  let customerTypes: string | null = null;
  const customerRe = /<[\w.-]+:(\w*Type[s]?OfCustomer\w*)\b[^>]*>([\s\S]*?)<\/[\w.-]+:\1>/i;
  const customerMatch = xml.match(customerRe);
  if (customerMatch) {
    // TextBlock bodies carry entity-escaped HTML — decode first, then strip the
    // revealed tags, then decode once more for double-escaped entities (&amp;amp;).
    const text = decodeXmlEntities(decodeXmlEntities(customerMatch[2]).replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (text && !/^(?:na|n\.?a\.?|nil|none|not applicable|-{1,3})$/i.test(text)) {
      customerTypes = text.slice(0, 1000);
      matchedTags.customerTypes = customerMatch[1];
    }
  }

  return {
    plantsNational,
    officesNational,
    plantsInternational,
    officesInternational,
    statesServed,
    countriesServed,
    exportsPctTurnover,
    customerTypes,
    matchedTags,
  };
}

/** Tag → {count, sample} histogram of numeric facts — backs --dump-tags. */
export function tagHistogram(xml: string): Map<string, { count: number; unit: string | null; sample: string }> {
  const hist = new Map<string, { count: number; unit: string | null; sample: string }>();
  for (const fact of extractFacts(xml)) {
    if (toNumber(fact.value) === null) continue;
    const entry = hist.get(fact.tag);
    if (entry) entry.count++;
    else hist.set(fact.tag, { count: 1, unit: fact.unitRef, sample: fact.value.slice(0, 20) });
  }
  return hist;
}
