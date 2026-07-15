/**
 * Read side of the Sustainalytics Material ESG Issues taxonomy for the community
 * admin UI. All three surfaces are anon-readable `_public` views (migrations 0019
 * + 0020) in the shared GreenMentor Supabase project, so reads go through the
 * RLS-bound server client, like the platform copy this is ported from.
 *
 * The NIC crosswalk (0020) is optional: if it hasn't been migrated/seeded yet the
 * read fails soft (subindustries simply render without a sector tag) rather than
 * breaking the page.
 */
import { createClient } from "@/lib/supabase/server";

export interface MeiCatalogItem {
  code: string;
  name: string;
  description: string;
  pillar: string | null;
  sortOrd: number;
}

export interface SubindustryNic {
  section: string;
  sectionTitle: string;
  division: string;
  divisionTitle: string;
  confidence: "high" | "medium" | "low";
}

export interface SubindustryMeiRef {
  code: string;
  name: string;
  sortOrd: number;
}

export interface SubindustryView {
  slug: string;
  name: string;
  nic: SubindustryNic | null;
  meis: SubindustryMeiRef[];
}

export interface SustainalyticsData {
  catalog: MeiCatalogItem[];
  subindustries: SubindustryView[];
  /** True when the NIC crosswalk (0020) is present, so the UI can label it. */
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
  subindustry_slug: string;
  subindustry_name: string;
  mei_code: string;
  mei_name: string;
  mei_sort_ord: number | null;
}

interface NicRow {
  subindustry_slug: string;
  nic_section: string;
  nic_section_title: string;
  nic_division: string;
  nic_division_title: string;
  confidence: SubindustryNic["confidence"];
}

export async function fetchSustainalytics(): Promise<SustainalyticsData> {
  const supabase = await createClient();

  const { data: catData, error: catErr } = await supabase
    .from("sustainalytics_material_issues_public")
    .select("code, name, description, pillar, sort_ord")
    .order("sort_ord", { ascending: true });
  if (catErr) throw new Error(catErr.message);
  const catalog: MeiCatalogItem[] = (catData ?? []).map((r: Record<string, unknown>) => ({
    code: r.code as string,
    name: r.name as string,
    description: r.description as string,
    pillar: (r.pillar as string | null) ?? null,
    sortOrd: (r.sort_ord as number | null) ?? 0,
  }));

  const pairs = await fetchAllRows<MatrixRow>((from, to) =>
    supabase
      .from("sustainalytics_subindustry_mei_public")
      .select("subindustry_slug, subindustry_name, mei_code, mei_name, mei_sort_ord")
      .range(from, to),
  );

  // NIC crosswalk — fail soft if 0020 isn't applied yet.
  const nicBySlug = new Map<string, SubindustryNic>();
  const { data: nicData } = await supabase
    .from("sustainalytics_subindustry_nic_public")
    .select("subindustry_slug, nic_section, nic_section_title, nic_division, nic_division_title, confidence");
  const hasCrosswalk = Array.isArray(nicData);
  for (const r of (nicData ?? []) as NicRow[]) {
    nicBySlug.set(r.subindustry_slug, {
      section: r.nic_section,
      sectionTitle: r.nic_section_title,
      division: r.nic_division,
      divisionTitle: r.nic_division_title,
      confidence: r.confidence,
    });
  }

  // Group the flat pair rows into one entry per subindustry.
  const bySlug = new Map<string, SubindustryView>();
  for (const p of pairs) {
    let entry = bySlug.get(p.subindustry_slug);
    if (!entry) {
      entry = { slug: p.subindustry_slug, name: p.subindustry_name, nic: nicBySlug.get(p.subindustry_slug) ?? null, meis: [] };
      bySlug.set(p.subindustry_slug, entry);
    }
    entry.meis.push({ code: p.mei_code, name: p.mei_name, sortOrd: p.mei_sort_ord ?? 0 });
  }
  const subindustries = [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const s of subindustries) s.meis.sort((a, b) => a.sortOrd - b.sortOrd);

  return { catalog, subindustries, hasCrosswalk };
}
