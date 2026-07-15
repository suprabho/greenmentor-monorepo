/**
 * Seed the Sustainalytics subindustry → NIC-2008 crosswalk.
 *
 *   node --env-file=.env.local --import tsx scripts/seed-sustainalytics-nic.ts [--dry-run]
 *
 * Reads the curated map in lib/sustainalytics/nic-crosswalk.ts, resolves each
 * NIC Division to its Section + titles via lib/brsr/nic-sector.ts (asserting the
 * intended Section matches, so a mistyped division can't slip through), checks
 * that the crosswalk exactly covers the subindustries stored by the scraper, and
 * upserts sustainalytics_subindustry_nic. Run after sustainalytics:scrape (the
 * FK requires the subindustry rows to exist).
 */
import { parseArgs } from "node:util";
import { createAdminClient } from "../lib/supabase/admin";
import { resolveNic } from "../lib/brsr/nic-sector";
import { SUBINDUSTRY_NIC_CROSSWALK } from "../lib/sustainalytics/nic-crosswalk";

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  const { values } = parseArgs({ args, options: { "dry-run": { type: "boolean", default: false } } });
  const dryRun = values["dry-run"];

  // Resolve + validate every crosswalk entry against the NIC tree.
  const rows = SUBINDUSTRY_NIC_CROSSWALK.map((e) => {
    const nic = resolveNic(e.division);
    if (!nic) throw new Error(`${e.slug}: NIC division "${e.division}" is not a real NIC-2008 Division`);
    if (nic.sectionLetter !== e.section) {
      throw new Error(
        `${e.slug}: division ${e.division} resolves to Section ${nic.sectionLetter} (${nic.sectionTitle}), but the map says Section ${e.section} — fix one`,
      );
    }
    return {
      subindustry_slug: e.slug,
      nic_section: nic.sectionLetter,
      nic_section_title: nic.sectionTitle,
      nic_division: nic.divisionCode,
      nic_division_title: nic.divisionTitle,
      confidence: e.confidence,
    };
  });

  const byConf = rows.reduce<Record<string, number>>((a, r) => {
    a[r.confidence] = (a[r.confidence] ?? 0) + 1;
    return a;
  }, {});
  console.log(
    `[crosswalk] ${rows.length} entries validated — high:${byConf.high ?? 0} medium:${byConf.medium ?? 0} low:${byConf.low ?? 0}`,
  );

  const supabase = createAdminClient();

  // Coverage check: the crosswalk must exactly match the stored subindustries.
  const { data: subs, error: subErr } = await supabase
    .from("sustainalytics_subindustries")
    .select("slug");
  if (subErr) throw new Error(`could not list subindustries: ${subErr.message} — run sustainalytics:scrape first?`);
  const dbSlugs = new Set((subs ?? []).map((s: { slug: string }) => s.slug));
  const mapSlugs = new Set(rows.map((r) => r.subindustry_slug));
  const missing = [...dbSlugs].filter((s) => !mapSlugs.has(s)); // stored but not mapped
  const extra = [...mapSlugs].filter((s) => !dbSlugs.has(s)); // mapped but not stored
  if (missing.length) console.warn(`[crosswalk] ! ${missing.length} subindustry(ies) have NO crosswalk entry: ${missing.join(", ")}`);
  if (extra.length) console.warn(`[crosswalk] ! ${extra.length} crosswalk slug(s) not in the DB (stale?): ${extra.join(", ")}`);

  if (dryRun) {
    console.log(`✓ dry-run — ${rows.length} entries, ${missing.length} uncovered, ${extra.length} stale — nothing written`);
    return;
  }

  const { error } = await supabase
    .from("sustainalytics_subindustry_nic")
    .upsert(rows, { onConflict: "subindustry_slug" });
  if (error) throw new Error(`crosswalk upsert failed: ${error.message}`);
  console.log(`✓ crosswalk seeded — ${rows.length} entries upserted`);
}

main().catch((e) => {
  console.error("crosswalk seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
