/**
 * SASB Materiality Finder scraper — single-source, idempotent.
 *
 *   node --env-file=.env.local --import tsx scripts/scrape-sasb.ts [flags]
 *
 * Pulls the whole SASB materiality map from the public, unauthenticated API that
 * navigator.sasb.ifrs.org reads (three JSON endpoints), and stores it:
 *   • /sectorIndustry            → the SICS taxonomy → sasb_industries (77)
 *   • /sustainability-dimensions → the 26 General Issue Categories → sasb_issue_categories
 *   • /industryTopics?…          → per industry, the *material* GICs and their
 *                                  disclosure topics →
 *                                    sasb_industry_issue_category (the matrix) +
 *                                    sasb_disclosure_topics (the drill-down)
 *
 * The dataset changes rarely (~annually); a run fully refreshes the matrix + topics.
 * Writes use the service-role client, so NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY must be set. Parsing is deterministic
 * (lib/sasb/parse.ts); the run cross-checks the three responses (every material GIC
 * exists in the catalog, every industry is known, dimensions agree) and aborts if
 * they diverge — an API redesign — rather than storing a half-broken taxonomy.
 *
 * Flags:
 *   --dry-run    fetch + parse + validate, log a summary, write nothing
 *   --out=PATH   also dump the parsed { industries, issueCategories, industryTopics } to JSON
 */
import { parseArgs } from "node:util";
import { writeFile } from "node:fs/promises";
import { createAdminClient } from "../lib/supabase/admin";
import {
  SASB_SOURCES,
  parseSectorIndustry,
  parseDimensions,
  parseIndustryTopics,
  type SasbIndustry,
  type SasbIssueCategory,
  type SasbIndustryTopics,
} from "../lib/sasb/parse";

// The API Gateway is content-agnostic, but send a browser-like UA + JSON Accept
// for parity with the app's own client.
const HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  Accept: "application/json, */*",
};

type Supabase = ReturnType<typeof createAdminClient>;

type Scraped = {
  industries: SasbIndustry[];
  issueCategories: SasbIssueCategory[];
  industryTopics: SasbIndustryTopics[];
};

type CliOptions = { dryRun: boolean; out?: string };

function parseCliOptions(): CliOptions {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift(); // `pnpm run … -- --flag` forwards the separator
  const { values } = parseArgs({
    args,
    options: {
      "dry-run": { type: "boolean", default: false },
      out: { type: "string" },
    },
  });
  return { dryRun: values["dry-run"], out: values.out };
}

const chunk = <T,>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));

async function fetchJson(url: string, label: string): Promise<unknown> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${label}: ${res.status} ${res.statusText} — ${url}`);
  const body = (await res.json()) as unknown;
  // The DataAPIClient surfaces failures as `{ error }` rather than a non-2xx.
  if (body && typeof body === "object" && !Array.isArray(body) && "error" in body) {
    throw new Error(`${label}: API returned error — ${String((body as { error: unknown }).error)}`);
  }
  return body;
}

// ── scrape + parse + validate ─────────────────────────────────────────────────

async function scrape(): Promise<Scraped> {
  console.log(`[fetch] sectors    ${SASB_SOURCES.sectorIndustry}`);
  const industries = parseSectorIndustry(await fetchJson(SASB_SOURCES.sectorIndustry, "sectorIndustry"));

  console.log(`[fetch] dimensions ${SASB_SOURCES.dimensions}`);
  const issueCategories = parseDimensions(await fetchJson(SASB_SOURCES.dimensions, "dimensions"));

  // Batch every industry code into a single industryTopics call.
  const codes = industries.map((i) => i.code);
  const topicsUrl = SASB_SOURCES.industryTopics(codes);
  console.log(`[fetch] topics     ${SASB_SOURCES.origin}/industryTopics?industries=<${codes.length} codes>&locale=en`);
  const industryTopics = parseIndustryTopics(await fetchJson(topicsUrl, "industryTopics"));

  const sectors = new Set(industries.map((i) => i.sector));
  const dimensions = new Set(issueCategories.map((c) => c.dimension));
  const pairs = industryTopics.reduce((n, it) => n + it.gics.length, 0);
  const topics = industryTopics.reduce((n, it) => n + it.gics.reduce((m, g) => m + g.topics.length, 0), 0);
  console.log(
    `[parse] ${sectors.size} sectors · ${industries.length} industries · ${issueCategories.length} issue categories · ` +
      `${dimensions.size} dimensions · ${pairs} material pairs · ${topics} topics`,
  );

  validate({ industries, issueCategories, industryTopics });
  return { industries, issueCategories, industryTopics };
}

/** Cross-endpoint integrity — abort on a divergence that would store a broken map. */
function validate({ industries, issueCategories, industryTopics }: Scraped): void {
  const industryCodes = new Set(industries.map((i) => i.code));
  const gicByCode = new Map(issueCategories.map((c) => [c.code, c]));

  const orphanIndustries: string[] = [];
  const orphanGics: string[] = [];
  const dimMismatches: string[] = [];
  const emptyPairs: string[] = [];
  const materialIndustries = new Set<string>();
  const materialGics = new Set<string>();

  for (const it of industryTopics) {
    if (!industryCodes.has(it.industryCode)) orphanIndustries.push(it.industryCode);
    materialIndustries.add(it.industryCode);
    for (const g of it.gics) {
      const canon = gicByCode.get(g.gicCode);
      if (!canon) {
        orphanGics.push(`${it.industryCode}/${g.gicCode}`);
        continue;
      }
      materialGics.add(g.gicCode);
      if (g.dimension && g.dimension !== canon.dimension) {
        dimMismatches.push(`${g.gicCode}: "${g.dimension}" ≠ "${canon.dimension}"`);
      }
      if (g.topics.length === 0) emptyPairs.push(`${it.industryCode}/${g.gicCode}`);
    }
  }

  // Hard failures — the taxonomy would be inconsistent.
  if (orphanIndustries.length > 0) {
    throw new Error(`industryTopics references industry code(s) absent from sectorIndustry: ${orphanIndustries.join(", ")}`);
  }
  if (orphanGics.length > 0) {
    throw new Error(`industryTopics references GIC code(s) absent from the dimensions catalog: ${orphanGics.join(", ")}`);
  }
  if (dimMismatches.length > 0) {
    throw new Error(`GIC dimension disagrees between industryTopics and dimensions: ${dimMismatches.join("; ")}`);
  }

  // Soft signals — unusual but not corrupting.
  if (emptyPairs.length > 0) {
    console.warn(`[parse] ! ${emptyPairs.length} material pair(s) with no disclosure topics: ${emptyPairs.slice(0, 10).join(", ")}${emptyPairs.length > 10 ? " …" : ""}`);
  }
  const unmapped = [...industryCodes].filter((c) => !materialIndustries.has(c));
  if (unmapped.length > 0) {
    console.warn(`[parse] ! ${unmapped.length} industry(ies) with no material topics: ${unmapped.join(", ")}`);
  }
  const unusedGics = [...gicByCode.keys()].filter((c) => !materialGics.has(c));
  if (unusedGics.length > 0) {
    console.warn(`[parse] ! ${unusedGics.length} issue categor(ies) not material to any industry: ${unusedGics.join(", ")}`);
  }
}

// ── store ──────────────────────────────────────────────────────────────────────

async function store(supabase: Supabase, data: Scraped): Promise<void> {
  // 1. Industries — upsert (stable PK = code).
  {
    const rows = data.industries.map((i) => ({
      code: i.code,
      name: i.name,
      sector: i.sector,
      description: i.description,
    }));
    const { error } = await supabase.from("sasb_industries").upsert(rows, { onConflict: "code" });
    if (error) throw new Error(`sasb_industries upsert failed: ${error.message}`);
    console.log(`[store] sasb_industries: ${rows.length} upserted`);
  }

  // 2. Issue categories — upsert (stable PK = code).
  {
    const rows = data.issueCategories.map((c) => ({
      code: c.code,
      name: c.name,
      dimension: c.dimension,
      description: c.description,
      sort_ord: c.sortOrd,
    }));
    const { error } = await supabase.from("sasb_issue_categories").upsert(rows, { onConflict: "code" });
    if (error) throw new Error(`sasb_issue_categories upsert failed: ${error.message}`);
    console.log(`[store] sasb_issue_categories: ${rows.length} upserted`);
  }

  // 3+4. Matrix + topics — full refresh. Delete topics (child of the matrix via a
  // composite FK) before the matrix, then reinsert matrix before topics.
  const pairs = data.industryTopics.flatMap((it) =>
    it.gics.map((g) => ({ industry_code: it.industryCode, issue_category_code: g.gicCode })),
  );
  const topics = data.industryTopics.flatMap((it) =>
    it.gics.flatMap((g) =>
      g.topics.map((t) => ({
        topic_code: t.code,
        industry_code: it.industryCode,
        issue_category_code: g.gicCode,
        name: t.name,
        description: t.description,
      })),
    ),
  );

  {
    const { error } = await supabase.from("sasb_disclosure_topics").delete().not("topic_code", "is", null);
    if (error) throw new Error(`sasb_disclosure_topics clear failed: ${error.message}`);
    const { error: mErr } = await supabase.from("sasb_industry_issue_category").delete().not("industry_code", "is", null);
    if (mErr) throw new Error(`sasb_industry_issue_category clear failed: ${mErr.message}`);
  }
  for (const batch of chunk(pairs, 500)) {
    const { error } = await supabase.from("sasb_industry_issue_category").insert(batch);
    if (error) throw new Error(`sasb_industry_issue_category insert failed: ${error.message}`);
  }
  console.log(`[store] sasb_industry_issue_category: ${pairs.length} pairs (refreshed)`);
  for (const batch of chunk(topics, 500)) {
    const { error } = await supabase.from("sasb_disclosure_topics").insert(batch);
    if (error) throw new Error(`sasb_disclosure_topics insert failed: ${error.message}`);
  }
  console.log(`[store] sasb_disclosure_topics: ${topics.length} topics (refreshed)`);
}

// ── main ────────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseCliOptions();
  const data = await scrape();

  if (opts.out) {
    await writeFile(opts.out, JSON.stringify(data, null, 2));
    console.log(`[out] wrote ${opts.out}`);
  }

  const pairs = data.industryTopics.reduce((n, it) => n + it.gics.length, 0);
  const topics = data.industryTopics.reduce((n, it) => n + it.gics.reduce((m, g) => m + g.topics.length, 0), 0);

  if (opts.dryRun) {
    console.log(
      `✓ dry-run — ${data.industries.length} industries, ${data.issueCategories.length} issue categories, ` +
        `${pairs} material pairs, ${topics} topics — nothing written`,
    );
    return;
  }

  const supabase = createAdminClient();
  await store(supabase, data);
  console.log(
    `✓ sasb scrape complete — ${data.industries.length} industries · ${data.issueCategories.length} issue categories · ` +
      `${pairs} material pairs · ${topics} topics`,
  );
}

main().catch((e) => {
  console.error("sasb scrape failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
