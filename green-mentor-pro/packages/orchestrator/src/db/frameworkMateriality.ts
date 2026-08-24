import { createAdminClient } from "../admin";
import { fetchAllRows } from "./brsrPeers";

/**
 * Read layer for the nic-framework-materiality agent's grounding tool: what the
 * external ESG frameworks prescribe as material for a NIC-2008 industry.
 *
 * Two of the three frameworks are Supabase tables scraped by the platform —
 * SASB (migrations 0021/0022) and Sustainalytics (0019/0020). Each ships a
 * curated crosswalk keyed by (nic_section, nic_division), so a NIC Division fans
 * out to the framework industries that cover it. The third, MSCI, is committed
 * TypeScript rather than a table and is resolved in ../frameworks/msci.ts.
 *
 * Service-role reads through the published *_public views, same rationale as
 * brsrPeers.ts / brsrTopics.ts: public reference data, server-side tool handlers
 * only. (The MSCI *taxonomy* is proprietary — see ../frameworks/msci.ts — but it
 * never touches Supabase.)
 *
 * Division vs Section matching: only 77 SASB industries and 138 Sustainalytics
 * subindustries are crosswalked, across 88 NIC Divisions, so a Division can have
 * no direct match. Each fetch therefore falls back to the NIC Section and
 * reports which level it matched at, so the agent can caveat a broad match
 * rather than silently presenting a Section-wide answer as industry-specific.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type MatchLevel = "division" | "section";
export type CrosswalkConfidence = "high" | "medium" | "low";

/** One framework industry the requested NIC codes crosswalk onto. */
export interface MatchedIndustry {
  /** Framework-native key: SASB SICS code, or Sustainalytics subindustry slug. */
  code: string;
  name: string;
  /** SASB SICS sector; null for Sustainalytics, which has no sector level. */
  sector: string | null;
  /** How the crosswalk row was reached — an exact NIC Division hit, or the wider Section. */
  matchLevel: MatchLevel;
  /** The crosswalk author's confidence in this industry→NIC mapping. */
  confidence: CrosswalkConfidence;
  nicDivision: string;
  nicSection: string;
}

/** A framework issue, unioned across every matched industry. */
export interface FrameworkIssue {
  /** Framework-native code: SASB General Issue Category code, or Sustainalytics MEI code. */
  code: string;
  name: string;
  description: string | null;
  /** SASB dimension, or the Sustainalytics MEI pillar — the framework's own grouping. */
  grouping: string | null;
  /** Framework industries (by name) that flag this issue as material. */
  industries: string[];
  /**
   * SASB only: the industry-specific Disclosure Topics under this General Issue
   * Category, which carry the concrete "what to disclose" wording.
   */
  disclosureTopics?: { code: string; name: string; description: string | null; industry: string }[];
}

export interface FrameworkResult {
  framework: "sasb" | "sustainalytics";
  matched: MatchedIndustry[];
  issues: FrameworkIssue[];
  /** Set when nothing crosswalked at either level — the agent must say so, not guess. */
  note: string | null;
}

/**
 * Rows from a crosswalk view for the given Divisions, falling back to the
 * Sections when a Division has no crosswalked industry at all.
 *
 * The fallback is per-Section rather than all-or-nothing: with NIC 20 (matched)
 * and NIC 84 (not matched) requested together, 20 keeps its precise industries
 * and only 84 widens to Section O.
 */
async function fetchCrosswalk(
  view: string,
  divisions: string[],
  sections: string[],
): Promise<{ row: Record<string, any>; matchLevel: MatchLevel }[]> {
  const admin = createAdminClient();
  const out: { row: Record<string, any>; matchLevel: MatchLevel }[] = [];

  const byDivision = divisions.length
    ? await fetchAllRows<Record<string, any>>((from, to) =>
        admin.from(view).select("*").in("nic_division", divisions).order("nic_division").range(from, to),
      )
    : [];
  for (const row of byDivision) out.push({ row, matchLevel: "division" });

  // Only widen the Sections that produced nothing at Division level.
  const hitSections = new Set(byDivision.map((r) => r.nic_section as string));
  const unmatched = sections.filter((s) => !hitSections.has(s));
  if (unmatched.length) {
    const bySection = await fetchAllRows<Record<string, any>>((from, to) =>
      admin.from(view).select("*").in("nic_section", unmatched).order("nic_section").range(from, to),
    );
    for (const row of bySection) out.push({ row, matchLevel: "section" });
  }
  return out;
}

/** Union `issues` by code, accumulating the industry names that flag each one. */
function unionByCode(
  rows: { code: string; name: string; description: string | null; grouping: string | null; industry: string }[],
): FrameworkIssue[] {
  const byCode = new Map<string, FrameworkIssue>();
  for (const r of rows) {
    const existing = byCode.get(r.code);
    if (existing) {
      if (!existing.industries.includes(r.industry)) existing.industries.push(r.industry);
      continue;
    }
    byCode.set(r.code, {
      code: r.code,
      name: r.name,
      description: r.description,
      grouping: r.grouping,
      industries: [r.industry],
    });
  }
  // Most broadly material first — the strongest signal that an issue is
  // industry-wide rather than an artifact of one loosely crosswalked industry.
  return [...byCode.values()].sort(
    (a, b) => b.industries.length - a.industries.length || a.name.localeCompare(b.name),
  );
}

/**
 * SASB General Issue Categories material to the crosswalked SICS industries,
 * with each category's industry-specific Disclosure Topics attached.
 */
export async function fetchSasbForNic(divisions: string[], sections: string[]): Promise<FrameworkResult> {
  const admin = createAdminClient();
  const crosswalk = await fetchCrosswalk("sasb_industry_nic_public", divisions, sections);
  if (!crosswalk.length) {
    return { framework: "sasb", matched: [], issues: [], note: "no SASB industry crosswalks to these NIC codes" };
  }

  const matched: MatchedIndustry[] = crosswalk.map(({ row, matchLevel }) => ({
    code: row.industry_code,
    name: row.industry_name,
    sector: row.sector ?? null,
    matchLevel,
    confidence: row.confidence,
    nicDivision: row.nic_division,
    nicSection: row.nic_section,
  }));
  const codes = [...new Set(matched.map((m) => m.code))];

  const [materiality, topics] = await Promise.all([
    fetchAllRows<Record<string, any>>((from, to) =>
      admin
        .from("sasb_materiality_public")
        .select("industry_code, industry_name, issue_category_code, issue_category_name, dimension, issue_category_sort_ord")
        .in("industry_code", codes)
        .order("issue_category_sort_ord", { ascending: true, nullsFirst: false })
        .order("issue_category_code")
        .range(from, to),
    ),
    fetchAllRows<Record<string, any>>((from, to) =>
      admin
        .from("sasb_disclosure_topics_public")
        .select("topic_code, topic_name, topic_description, industry_code, industry_name, issue_category_code")
        .in("industry_code", codes)
        .order("topic_code")
        .range(from, to),
    ),
  ]);

  // Category descriptions live on the catalog, not the matrix view.
  const catCodes = [...new Set(materiality.map((r) => r.issue_category_code as string))];
  const descriptions = new Map<string, string | null>();
  for (let i = 0; i < catCodes.length; i += 150) {
    const { data, error } = await admin
      .from("sasb_issue_categories_public")
      .select("code, description")
      .in("code", catCodes.slice(i, i + 150));
    if (error) throw new Error(error.message);
    for (const c of data ?? []) descriptions.set(c.code, c.description ?? null);
  }

  const issues = unionByCode(
    materiality.map((r) => ({
      code: r.issue_category_code,
      name: r.issue_category_name,
      description: descriptions.get(r.issue_category_code) ?? null,
      grouping: r.dimension ?? null,
      industry: r.industry_name,
    })),
  );

  const topicsByCategory = new Map<string, FrameworkIssue["disclosureTopics"]>();
  for (const t of topics) {
    const list = topicsByCategory.get(t.issue_category_code) ?? [];
    list.push({
      code: t.topic_code,
      name: t.topic_name,
      description: t.topic_description ?? null,
      industry: t.industry_name,
    });
    topicsByCategory.set(t.issue_category_code, list);
  }
  for (const issue of issues) issue.disclosureTopics = topicsByCategory.get(issue.code) ?? [];

  return {
    framework: "sasb",
    matched,
    issues,
    note: matched.every((m) => m.matchLevel === "section")
      ? "no SASB industry maps to these NIC Divisions — matched at the wider NIC Section"
      : null,
  };
}

/** Sustainalytics Material ESG Issues for the crosswalked subindustries. */
export async function fetchSustainalyticsForNic(
  divisions: string[],
  sections: string[],
): Promise<FrameworkResult> {
  const admin = createAdminClient();
  const crosswalk = await fetchCrosswalk("sustainalytics_subindustry_nic_public", divisions, sections);
  if (!crosswalk.length) {
    return {
      framework: "sustainalytics",
      matched: [],
      issues: [],
      note: "no Sustainalytics subindustry crosswalks to these NIC codes",
    };
  }

  const matched: MatchedIndustry[] = crosswalk.map(({ row, matchLevel }) => ({
    code: row.subindustry_slug,
    name: row.subindustry_name,
    sector: null,
    matchLevel,
    confidence: row.confidence,
    nicDivision: row.nic_division,
    nicSection: row.nic_section,
  }));
  const slugs = [...new Set(matched.map((m) => m.code))];

  const mei = await fetchAllRows<Record<string, any>>((from, to) =>
    admin
      .from("sustainalytics_subindustry_mei_public")
      .select("subindustry_slug, subindustry_name, mei_code, mei_name, mei_pillar, mei_sort_ord")
      .in("subindustry_slug", slugs)
      .order("mei_sort_ord", { ascending: true, nullsFirst: false })
      .order("mei_code")
      .range(from, to),
  );

  // The MEI catalog carries the one-line definitions the matrix view omits.
  const meiCodes = [...new Set(mei.map((r) => r.mei_code as string))];
  const descriptions = new Map<string, string | null>();
  for (let i = 0; i < meiCodes.length; i += 150) {
    const { data, error } = await admin
      .from("sustainalytics_material_issues_public")
      .select("code, description")
      .in("code", meiCodes.slice(i, i + 150));
    if (error) throw new Error(error.message);
    for (const c of data ?? []) descriptions.set(c.code, c.description ?? null);
  }

  const issues = unionByCode(
    mei.map((r) => ({
      code: r.mei_code,
      name: r.mei_name,
      description: descriptions.get(r.mei_code) ?? null,
      grouping: r.mei_pillar ?? null,
      industry: r.subindustry_name,
    })),
  );

  return {
    framework: "sustainalytics",
    matched,
    issues,
    note: matched.every((m) => m.matchLevel === "section")
      ? "no Sustainalytics subindustry maps to these NIC Divisions — matched at the wider NIC Section"
      : null,
  };
}
