/**
 * Sustainalytics Material ESG Issues (MEI) scraper — single-source, idempotent.
 *
 *   node --env-file=.env.local --import tsx scripts/scrape-sustainalytics.ts [flags]
 *
 * Pulls three public artifacts from the MEI Resource Center and stores them:
 *   • the resource-center page HTML → the MEI catalog (22 issues, name + description)
 *       → sustainalytics_material_issues
 *   • the backend subindustry-meis.json → the subindustry → applicable-MEI matrix
 *       → sustainalytics_subindustries + sustainalytics_subindustry_mei
 *   • the "Definitions of MEIs" PDF → private `sustainalytics` Storage bucket
 *
 * The dataset changes rarely (~annually); a run fully refreshes it. Writes use
 * the service-role client, so NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * must be set. Parsing is deterministic (lib/sustainalytics/parse.ts); the run
 * cross-checks the catalog codes against the matrix codes and aborts if they
 * diverge (a page redesign) rather than storing a half-broken taxonomy.
 *
 * Flags:
 *   --dry-run      fetch + parse + validate, log a summary, write nothing
 *   --no-pdf       skip archiving the Definitions PDF
 *   --out=PATH     also dump the parsed { catalog, subindustries } to a local JSON file
 */
import { parseArgs } from "node:util";
import { writeFile } from "node:fs/promises";
import { createAdminClient } from "../lib/supabase/admin";
import {
  SUSTAINALYTICS_SOURCES,
  parseMeiCatalog,
  parseSubindustryMatrix,
  type MeiCatalogEntry,
  type SubindustryMei,
} from "../lib/sustainalytics/parse";

const BUCKET = "sustainalytics";
const PDF_OBJECT = "definitionsofmeis.pdf";

// Browser-like UA + Referer — the JSON/PDF are served behind the same CDN as the
// page and a bare fetch can be treated as a hotlink.
const HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  Referer: SUSTAINALYTICS_SOURCES.page,
  Accept: "*/*",
};

type Supabase = ReturnType<typeof createAdminClient>;

type CliOptions = {
  dryRun: boolean;
  noPdf: boolean;
  out?: string;
};

function parseCliOptions(): CliOptions {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift(); // `pnpm run … -- --flag` forwards the separator
  const { values } = parseArgs({
    args,
    options: {
      "dry-run": { type: "boolean", default: false },
      "no-pdf": { type: "boolean", default: false },
      out: { type: "string" },
    },
  });
  return { dryRun: values["dry-run"], noPdf: values["no-pdf"], out: values.out };
}

async function fetchText(url: string, label: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${label}: ${res.status} ${res.statusText} — ${url}`);
  return res.text();
}

const chunk = <T,>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));

// ── scrape + parse ───────────────────────────────────────────────────────────

async function scrape(): Promise<{ catalog: MeiCatalogEntry[]; subindustries: SubindustryMei[] }> {
  console.log(`[fetch] page   ${SUSTAINALYTICS_SOURCES.page}`);
  const html = await fetchText(SUSTAINALYTICS_SOURCES.page, "page");
  console.log(`[fetch] matrix ${SUSTAINALYTICS_SOURCES.matrixJson}`);
  const matrixText = await fetchText(SUSTAINALYTICS_SOURCES.matrixJson, "matrix json");

  const catalog = parseMeiCatalog(html);
  const subindustries = parseSubindustryMatrix(JSON.parse(matrixText));
  console.log(`[parse] ${catalog.length} MEIs · ${subindustries.length} subindustries`);

  // Integrity: every MEI referenced by the matrix must exist in the catalog.
  const catalogCodes = new Set(catalog.map((c) => c.code));
  const matrixCodes = new Set(subindustries.flatMap((s) => s.meiCodes));
  const orphans = [...matrixCodes].filter((c) => !catalogCodes.has(c));
  if (orphans.length > 0) {
    throw new Error(
      `matrix references MEI code(s) absent from the catalog — page/JSON out of sync: ${orphans.join(", ")}`,
    );
  }
  const unusedCatalog = [...catalogCodes].filter((c) => !matrixCodes.has(c));
  if (unusedCatalog.length > 0) {
    console.warn(`[parse] ! ${unusedCatalog.length} catalog MEI(s) not used by any subindustry: ${unusedCatalog.join(", ")}`);
  }
  const empty = subindustries.filter((s) => s.meiCodes.length === 0);
  if (empty.length > 0) {
    console.warn(`[parse] ! ${empty.length} subindustry(ies) with no MEIs: ${empty.map((s) => s.slug).join(", ")}`);
  }
  return { catalog, subindustries };
}

// ── store ────────────────────────────────────────────────────────────────────

async function store(
  supabase: Supabase,
  catalog: MeiCatalogEntry[],
  subindustries: SubindustryMei[],
): Promise<void> {
  // 1. Catalog — upsert (stable PK = code).
  {
    const rows = catalog.map((c) => ({
      code: c.code,
      name: c.name,
      description: c.description,
      sort_ord: c.sortOrd,
    }));
    const { error } = await supabase
      .from("sustainalytics_material_issues")
      .upsert(rows, { onConflict: "code" });
    if (error) throw new Error(`material_issues upsert failed: ${error.message}`);
    console.log(`[store] material_issues: ${rows.length} upserted`);
  }

  // 2. Subindustries — upsert (stable PK = slug).
  {
    const rows = subindustries.map((s) => ({ slug: s.slug, name: s.name }));
    const { error } = await supabase
      .from("sustainalytics_subindustries")
      .upsert(rows, { onConflict: "slug" });
    if (error) throw new Error(`subindustries upsert failed: ${error.message}`);
    console.log(`[store] subindustries: ${rows.length} upserted`);
  }

  // 3. Matrix — full refresh: wipe every pair, then reinsert. mei_code is NOT
  // NULL, so `not is null` matches all rows (Supabase requires a filter).
  {
    const { error: delErr } = await supabase
      .from("sustainalytics_subindustry_mei")
      .delete()
      .not("mei_code", "is", null);
    if (delErr) throw new Error(`subindustry_mei clear failed: ${delErr.message}`);

    const pairs = subindustries.flatMap((s) =>
      s.meiCodes.map((code) => ({ subindustry_slug: s.slug, mei_code: code })),
    );
    for (const batch of chunk(pairs, 500)) {
      const { error: insErr } = await supabase.from("sustainalytics_subindustry_mei").insert(batch);
      if (insErr) throw new Error(`subindustry_mei insert failed: ${insErr.message}`);
    }
    console.log(`[store] subindustry_mei: ${pairs.length} pairs (refreshed)`);
  }
}

async function ensureBucket(supabase: Supabase): Promise<void> {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
  if (error && !/exists|duplicate/i.test(error.message)) {
    throw new Error(`could not ensure bucket ${BUCKET}: ${error.message}`);
  }
}

async function archivePdf(supabase: Supabase): Promise<void> {
  await ensureBucket(supabase);
  const res = await fetch(SUSTAINALYTICS_SOURCES.definitionsPdf, {
    headers: HEADERS,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`definitions pdf: ${res.status} ${res.statusText}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(PDF_OBJECT, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`pdf upload failed: ${error.message}`);
  console.log(`[store] ${BUCKET}/${PDF_OBJECT}: ${(bytes.length / 1024).toFixed(0)} KB`);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseCliOptions();
  const { catalog, subindustries } = await scrape();

  if (opts.out) {
    await writeFile(opts.out, JSON.stringify({ catalog, subindustries }, null, 2));
    console.log(`[out] wrote ${opts.out}`);
  }

  if (opts.dryRun) {
    const pairs = subindustries.reduce((n, s) => n + s.meiCodes.length, 0);
    console.log(
      `✓ dry-run — ${catalog.length} MEIs, ${subindustries.length} subindustries, ${pairs} pairs${opts.noPdf ? "" : " (+ PDF)"} — nothing written`,
    );
    return;
  }

  const supabase = createAdminClient();
  await store(supabase, catalog, subindustries);
  if (!opts.noPdf) await archivePdf(supabase);

  const pairs = subindustries.reduce((n, s) => n + s.meiCodes.length, 0);
  console.log(
    `✓ sustainalytics scrape complete — ${catalog.length} MEIs · ${subindustries.length} subindustries · ${pairs} pairs`,
  );
}

main().catch((e) => {
  console.error("sustainalytics scrape failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
