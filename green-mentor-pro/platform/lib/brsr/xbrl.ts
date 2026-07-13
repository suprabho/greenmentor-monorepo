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

/** Named + numeric XML entities (ingest-feed's decode() lacks the numeric forms). */
export function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
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
