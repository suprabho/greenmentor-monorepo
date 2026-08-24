/**
 * @gm/orchestrator/frameworks — the framework-materiality grounding layer for the
 * nic-framework-materiality agent, exposed as a narrow subpath for the same reason
 * as ../peer: consumer apps (the Agent Studio in esg-agents) wire the tool without
 * importing the package barrel, which drags in the whole engagement pipeline.
 *
 * Where ../peer answers "what do peer companies DISCLOSE as material" from the BRSR
 * corpus, this answers "what do the external frameworks PRESCRIBE as material for
 * this industry" — SASB, Sustainalytics and MSCI, all reached by NIC-2008 code.
 * The two are deliberately separate agents; a materiality assessment compares them.
 *
 * The tool body lives here (not in ../toolHandlers.ts) so the platform and the
 * Studio ground agent runs through one implementation.
 */
import { resolveCompany } from "../db/brsrPeers";
import { truncateAtWord } from "../db/brsrTopics";
import { resolveNic, turnoverWeightedSector } from "../nic/sector";
import {
  fetchSasbForNic,
  fetchSustainalyticsForNic,
  type FrameworkIssue,
  type FrameworkResult,
  type MatchedIndustry,
} from "../db/frameworkMateriality";
import { fetchMsciForNic, type MsciIssue, type MsciResult } from "./msci";

export { fetchSasbForNic, fetchSustainalyticsForNic } from "../db/frameworkMateriality";
export { fetchMsciForNic, MSCI_AS_OF, type MsciIssue, type MsciResult } from "./msci";
export type {
  FrameworkIssue,
  FrameworkResult,
  MatchedIndustry,
  MatchLevel,
} from "../db/frameworkMateriality";

/** Tool names the nic-framework-materiality agent may call (its tools.json). */
export const FRAMEWORK_TOOL_NAMES = ["get_nic_framework_materiality"] as const;

export const ALL_FRAMEWORKS = ["sasb", "sustainalytics", "msci"] as const;
export type FrameworkKey = (typeof ALL_FRAMEWORKS)[number];

/** How many descriptive characters each issue carries into the model payload. */
const MAX_DESCRIPTION = 400;

/**
 * Caps for a NIC Section match. Widening a Division to its Section can fan out to
 * the whole sector — NIC 33 in Section C reaches 30 SASB industries, 47
 * Sustainalytics subindustries and 50 GICS sub-industries, a ~166KB payload whose
 * honest reading is "everything in manufacturing". Capping the industry lists and
 * dropping the (by definition industry-specific) SASB Disclosure Topics keeps the
 * payload proportionate; `prevalence` below is what carries the real signal at
 * this level — how much of the sector flags the issue, not which members do.
 */
const MAX_INDUSTRIES_LISTED = 12;
const MAX_INDUSTRIES_PER_ISSUE = 8;

/** The NIC scope a run resolved to, however it was specified. */
export interface NicScope {
  divisions: { code: string; title: string; section: string }[];
  sections: { letter: string; title: string }[];
  /** Input NIC codes that resolved to no NIC-2008 Division. */
  unresolved: string[];
  /** Set on the symbol path — how the Divisions were derived. */
  fromSymbol: {
    symbol: string;
    name: string;
    fy: string;
    /** Division code → share of *mapped* turnover (0..1), descending. */
    turnoverShares: { division: string; weight: number }[];
    mappedCoverage: number;
  } | null;
}

/** Uppercased, deduped, order-preserving code list, capped (strict schemas can't carry bounds). */
export function normalizeNicCodes(codes: unknown, cap = 10): string[] {
  if (!Array.isArray(codes)) return [];
  const cleaned = codes
    .filter((c): c is string | number => typeof c === "string" || typeof c === "number")
    .map((c) => String(c).replace(/\D/g, ""))
    .filter(Boolean);
  return [...new Set(cleaned)].slice(0, cap);
}

/** Requested frameworks, defaulting to all three; unknown names are dropped. */
export function normalizeFrameworks(input: unknown): FrameworkKey[] {
  if (!Array.isArray(input) || !input.length) return [...ALL_FRAMEWORKS];
  const wanted = new Set(input.filter((f): f is string => typeof f === "string").map((f) => f.trim().toLowerCase()));
  const picked = ALL_FRAMEWORKS.filter((f) => wanted.has(f));
  return picked.length ? picked : [...ALL_FRAMEWORKS];
}

/** Resolve raw NIC codes onto their Divisions + Sections, keeping unresolved codes visible. */
export function scopeFromNicCodes(codes: string[]): NicScope {
  const divisions = new Map<string, { code: string; title: string; section: string }>();
  const sections = new Map<string, { letter: string; title: string }>();
  const unresolved: string[] = [];
  for (const code of codes) {
    const res = resolveNic(code);
    if (!res) {
      unresolved.push(code);
      continue;
    }
    divisions.set(res.divisionCode, {
      code: res.divisionCode,
      title: res.divisionTitle,
      section: res.sectionLetter,
    });
    sections.set(res.sectionLetter, { letter: res.sectionLetter, title: res.sectionTitle });
  }
  return { divisions: [...divisions.values()], sections: [...sections.values()], unresolved, fromSymbol: null };
}

/**
 * The NIC scope a BRSR filer operates in: its Section A product rows,
 * turnover-weighted onto Divisions.
 *
 * Divisions below `minShare` of mapped turnover are dropped — a filer's long tail
 * of incidental product lines would otherwise fan out into framework industries
 * that have nothing to do with the business. The dominant Division always
 * survives, whatever its share.
 */
export async function scopeFromSymbol(symbol: string, minShare = 0.1): Promise<NicScope | null> {
  const profile = await resolveCompany({ symbol });
  if (!profile) return null;

  const weighted = turnoverWeightedSector(
    profile.activities.map((a) => ({ nicCode: a.nicCode, turnover: a.turnover })),
  );
  const kept = weighted.industryShares.filter((s, i) => i === 0 || s.weight >= minShare);

  const sections = new Map<string, { letter: string; title: string }>();
  for (const share of weighted.sectionShares) {
    if (kept.some((k) => k.sectionLetter === share.sectionLetter)) {
      sections.set(share.sectionLetter, { letter: share.sectionLetter, title: share.sectionTitle });
    }
  }

  return {
    divisions: kept.map((s) => ({ code: s.divisionCode, title: s.divisionTitle, section: s.sectionLetter })),
    sections: [...sections.values()],
    unresolved: [],
    fromSymbol: {
      symbol: profile.symbol,
      name: profile.legalName ?? profile.companyName,
      fy: profile.fy,
      turnoverShares: kept.map((s) => ({ division: s.divisionCode, weight: Math.round(s.weight * 1000) / 1000 })),
      mappedCoverage: Math.round(weighted.mappedCoverage * 1000) / 1000,
    },
  };
}

/** Compact matched-industry row for the model. */
function matchedForModel(m: MatchedIndustry) {
  return {
    code: m.code,
    name: m.name,
    sector: m.sector,
    nic: `${m.nicSection} / ${m.nicDivision}`,
    matched_at: m.matchLevel,
    crosswalk_confidence: m.confidence,
  };
}

/**
 * Share of the matched industries that flag this issue (0..1) — the ranking signal
 * that survives a wide Section match, where the individual industry names stop
 * being informative.
 */
const prevalence = (flagging: number, matched: number) =>
  matched > 0 ? Math.round((flagging / matched) * 100) / 100 : 0;

/** Industry names, capped; the full count always travels alongside. */
const cappedIndustries = (names: string[]) => names.slice(0, MAX_INDUSTRIES_PER_ISSUE);

/** Compact SASB / Sustainalytics issue row for the model. */
function issueForModel(issue: FrameworkIssue, matchedCount: number, broad: boolean) {
  return {
    code: issue.code,
    name: issue.name,
    description: issue.description ? truncateAtWord(issue.description, MAX_DESCRIPTION) : null,
    framework_grouping: issue.grouping,
    industries: cappedIndustries(issue.industries),
    industry_count: issue.industries.length,
    prevalence: prevalence(issue.industries.length, matchedCount),
    // Disclosure Topics are industry-specific wording; under a Section-wide match
    // they would be a few hundred rows from unrelated industries.
    disclosure_topics:
      !broad && issue.disclosureTopics?.length
        ? issue.disclosureTopics.map((t) => ({
            code: t.code,
            name: t.name,
            industry: t.industry,
            description: t.description ? truncateAtWord(t.description, MAX_DESCRIPTION) : null,
          }))
        : undefined,
  };
}

/** Compact MSCI Key Issue row — the weights are what this framework uniquely adds. */
function msciIssueForModel(issue: MsciIssue, matchedCount: number) {
  return {
    code: issue.code,
    name: issue.name,
    description: issue.description ? truncateAtWord(issue.description, MAX_DESCRIPTION) : null,
    framework_grouping: issue.grouping,
    pillar: issue.pillar,
    industries: cappedIndustries(issue.industries),
    industry_count: issue.industries.length,
    prevalence: prevalence(issue.industries.length, matchedCount),
    avg_weight_pct: issue.avgWeight,
    max_weight_pct: issue.maxWeight,
    company_specific: issue.companySpecific,
  };
}

/**
 * What SASB, Sustainalytics and MSCI each prescribe as material for a NIC-2008
 * industry, batched into one call so the agent grounds once and then dedupes.
 *
 * Accepts NIC codes directly, or an NSE symbol whose BRSR Section A product rows
 * are turnover-weighted into Divisions. Framework industries are matched at NIC
 * Division level, widening to the Section only where a Division has no mapped
 * industry — `matched_at` makes that visible per row rather than silently
 * presenting a Section-wide answer as industry-specific.
 */
export async function getNicFrameworkMateriality(input: unknown): Promise<unknown> {
  const { nic_codes, symbol, frameworks } = (input ?? {}) as {
    nic_codes?: (string | number)[] | null;
    symbol?: string | null;
    frameworks?: string[] | null;
  };

  const codes = normalizeNicCodes(nic_codes);
  const sym = typeof symbol === "string" ? symbol.trim().toUpperCase() : "";
  if (!codes.length && !sym) {
    return { scope: null, frameworks: {}, note: "provide nic_codes (2-8 digit NIC-2008) or an NSE symbol" };
  }

  const wanted = normalizeFrameworks(frameworks);

  try {
    let scope: NicScope;
    if (codes.length) {
      scope = scopeFromNicCodes(codes);
    } else {
      const fromSymbol = await scopeFromSymbol(sym);
      if (!fromSymbol) {
        return {
          scope: null,
          frameworks: {},
          note: `no profiled BRSR filing for symbol "${sym}" — pass nic_codes directly, or try another symbol`,
        };
      }
      scope = fromSymbol;
    }

    if (!scope.divisions.length) {
      return {
        scope,
        frameworks: {},
        note: scope.unresolved.length
          ? `none of these NIC codes resolve to a NIC-2008 Division: ${scope.unresolved.join(", ")}`
          : "no NIC Division could be resolved for this input",
      };
    }

    const divisions = scope.divisions.map((d) => d.code);
    const sections = scope.sections.map((s) => s.letter);

    // SASB and Sustainalytics are independent Supabase reads; MSCI is in-process.
    const [sasb, sustainalytics] = await Promise.all([
      wanted.includes("sasb") ? fetchSasbForNic(divisions, sections) : null,
      wanted.includes("sustainalytics") ? fetchSustainalyticsForNic(divisions, sections) : null,
    ]);
    const msci: MsciResult | null = wanted.includes("msci") ? fetchMsciForNic(divisions, sections) : null;

    const payload: Record<string, unknown> = {};
    for (const result of [sasb, sustainalytics] as (FrameworkResult | null)[]) {
      if (!result) continue;
      const broad = result.matched.length > 0 && result.matched.every((m) => m.matchLevel === "section");
      payload[result.framework] = {
        matched_industries: result.matched.slice(0, MAX_INDUSTRIES_LISTED).map(matchedForModel),
        matched_count: result.matched.length,
        issues: result.issues.map((i) => issueForModel(i, result.matched.length, broad)),
        issue_count: result.issues.length,
        note: result.note,
      };
    }
    if (msci) {
      payload.msci = {
        matched_industries: msci.matched.slice(0, MAX_INDUSTRIES_LISTED).map(matchedForModel),
        matched_count: msci.matched.length,
        issues: msci.issues.map((i) => msciIssueForModel(i, msci.matched.length)),
        issue_count: msci.issues.length,
        weights_as_of: msci.asOf,
        licence: "PROPRIETARY MSCI reference data — internal use only, not for publication or redistribution",
        note: msci.note,
      };
    }

    const widened = [sasb, sustainalytics, msci].filter(
      (r): r is FrameworkResult | MsciResult => !!r && r.matched.length > 0 && r.matched.every((m) => m.matchLevel === "section"),
    );
    const empty = [sasb, sustainalytics, msci].filter(
      (r): r is FrameworkResult | MsciResult => !!r && r.matched.length === 0,
    );
    const notes = [
      scope.unresolved.length ? `NIC codes that resolved to no Division: ${scope.unresolved.join(", ")}` : null,
      widened.length ? `matched at NIC Section (no Division-level industry): ${widened.map((r) => r.framework).join(", ")}` : null,
      empty.length ? `no crosswalked industry at all: ${empty.map((r) => r.framework).join(", ")}` : null,
      msci ? "MSCI rows are proprietary reference data — the emitted table is internal-use only" : null,
    ].filter(Boolean);

    return {
      scope: {
        divisions: scope.divisions,
        sections: scope.sections,
        unresolved: scope.unresolved,
        from_symbol: scope.fromSymbol,
      },
      frameworks: payload,
      frameworks_requested: wanted,
      note: notes.length ? notes.join("; ") : null,
    };
  } catch (e) {
    return { scope: null, frameworks: {}, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Dispatch a framework grounding tool by name; null for a name this layer doesn't own. */
export function runFrameworkTool(name: string, input: unknown): Promise<unknown> | null {
  if (name === "get_nic_framework_materiality") return getNicFrameworkMateriality(input);
  return null;
}
