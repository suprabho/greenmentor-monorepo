/**
 * Read side of the SASB Materiality Finder taxonomy for the community admin hub.
 * All surfaces are anon-readable `_public` views (migrations 0021 + 0022), so
 * reads go through the RLS-bound server client, like lib/sustainalytics/repo.ts
 * in the platform app.
 *
 * The NIC crosswalk (0022) is optional: if it hasn't been migrated/seeded yet the
 * read fails soft (industries simply render without a sector tag) rather than
 * breaking the page.
 */
import { createClient } from "@/lib/supabase/server";

export interface IssueCategory {
  code: string;
  name: string;
  dimension: string;
  description: string;
  sortOrd: number;
}

export interface IndustryNic {
  section: string;
  sectionTitle: string;
  division: string;
  divisionTitle: string;
  confidence: "high" | "medium" | "low";
}

export interface TopicRef {
  code: string;
  name: string;
  description: string;
}

export interface MaterialIssue {
  code: string;
  name: string;
  dimension: string;
  sortOrd: number;
  topics: TopicRef[];
}

export interface IndustryView {
  code: string;
  name: string;
  sector: string;
  nic: IndustryNic | null;
  /** General Issue Categories material to this industry, in canonical order. */
  issues: MaterialIssue[];
}

export interface SasbData {
  /** The 26 General Issue Categories (canonical, with dimension). */
  issueCategories: IssueCategory[];
  /** The 77 SICS industries, each with its material issues + disclosure topics. */
  industries: IndustryView[];
  /** Count of material (industry × issue-category) pairs. */
  pairCount: number;
  /** Count of disclosure topics. */
  topicCount: number;
  /** True when the NIC crosswalk (0022) is present, so the UI can label it. */
  hasCrosswalk: boolean;
}

/** PostgREST caps responses at 1000 rows; page through until a short page. */
async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < page) return out;
  }
}

interface MatrixRow {
  industry_code: string;
  industry_name: string;
  sector: string;
  issue_category_code: string;
  issue_category_name: string;
  dimension: string;
  issue_category_sort_ord: number | null;
}

interface TopicRow {
  industry_code: string;
  issue_category_code: string;
  topic_code: string;
  topic_name: string;
  topic_description: string;
}

interface NicRow {
  industry_code: string;
  nic_section: string;
  nic_section_title: string;
  nic_division: string;
  nic_division_title: string;
  confidence: IndustryNic["confidence"];
}

export async function fetchSasb(): Promise<SasbData> {
  const supabase = await createClient();

  // The 26 General Issue Categories (dimension + description), canonical order.
  const { data: catData, error: catErr } = await supabase
    .from("sasb_issue_categories_public")
    .select("code, name, dimension, description, sort_ord")
    .order("sort_ord", { ascending: true });
  if (catErr) throw new Error(catErr.message);
  const issueCategories: IssueCategory[] = (catData ?? []).map((r: Record<string, unknown>) => ({
    code: r.code as string,
    name: r.name as string,
    dimension: r.dimension as string,
    description: (r.description as string | null) ?? "",
    sortOrd: (r.sort_ord as number | null) ?? 0,
  }));

  // The materiality matrix (industry × material issue category) — carries sector + dimension.
  const matrix = await fetchAllRows<MatrixRow>((from, to) =>
    supabase
      .from("sasb_materiality_public")
      .select(
        "industry_code, industry_name, sector, issue_category_code, issue_category_name, dimension, issue_category_sort_ord",
      )
      .range(from, to),
  );

  // The disclosure topics under each material pair.
  const topics = await fetchAllRows<TopicRow>((from, to) =>
    supabase
      .from("sasb_disclosure_topics_public")
      .select("industry_code, issue_category_code, topic_code, topic_name, topic_description")
      .range(from, to),
  );

  // NIC crosswalk — fail soft if 0022 isn't applied/seeded yet.
  const nicByCode = new Map<string, IndustryNic>();
  const { data: nicData } = await supabase
    .from("sasb_industry_nic_public")
    .select("industry_code, nic_section, nic_section_title, nic_division, nic_division_title, confidence");
  const hasCrosswalk = Array.isArray(nicData);
  for (const r of (nicData ?? []) as NicRow[]) {
    nicByCode.set(r.industry_code, {
      section: r.nic_section,
      sectionTitle: r.nic_section_title,
      division: r.nic_division,
      divisionTitle: r.nic_division_title,
      confidence: r.confidence,
    });
  }

  // Topics grouped by industry × issue-category, sorted by topic code.
  const topicsByKey = new Map<string, TopicRef[]>();
  for (const t of topics) {
    const key = `${t.industry_code}|${t.issue_category_code}`;
    let list = topicsByKey.get(key);
    if (!list) topicsByKey.set(key, (list = []));
    list.push({ code: t.topic_code, name: t.topic_name, description: t.topic_description });
  }
  for (const list of topicsByKey.values()) list.sort((a, b) => a.code.localeCompare(b.code));

  // Build one entry per industry from the matrix rows.
  const byCode = new Map<string, IndustryView>();
  for (const m of matrix) {
    let ind = byCode.get(m.industry_code);
    if (!ind) {
      ind = { code: m.industry_code, name: m.industry_name, sector: m.sector, nic: nicByCode.get(m.industry_code) ?? null, issues: [] };
      byCode.set(m.industry_code, ind);
    }
    ind.issues.push({
      code: m.issue_category_code,
      name: m.issue_category_name,
      dimension: m.dimension,
      sortOrd: m.issue_category_sort_ord ?? 0,
      topics: topicsByKey.get(`${m.industry_code}|${m.issue_category_code}`) ?? [],
    });
  }
  const industries = [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const ind of industries) ind.issues.sort((a, b) => a.sortOrd - b.sortOrd);

  return { issueCategories, industries, pairCount: matrix.length, topicCount: topics.length, hasCrosswalk };
}
