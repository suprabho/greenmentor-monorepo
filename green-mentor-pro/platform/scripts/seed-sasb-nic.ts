/**
 * Seed the SASB SICS industry → NIC-2008 crosswalk.
 *
 *   node --env-file=.env.local --import tsx scripts/seed-sasb-nic.ts [--dry-run]
 *
 * Reads the curated map in lib/sasb/nic-crosswalk.ts, resolves each NIC Division
 * to its Section + titles via lib/brsr/nic-sector.ts (asserting the intended
 * Section matches, so a mistyped division can't slip through), checks that the
 * crosswalk exactly covers the industries stored by the scraper, and upserts
 * sasb_industry_nic. Run after sasb:scrape (the FK requires the industry rows to
 * exist) and after applying migration 0022.
 */
import { parseArgs } from "node:util";
import { createAdminClient } from "../lib/supabase/admin";
import { resolveNic } from "../lib/brsr/nic-sector";
import { SASB_NIC_CROSSWALK } from "../lib/sasb/nic-crosswalk";

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  const { values } = parseArgs({ args, options: { "dry-run": { type: "boolean", default: false } } });
  const dryRun = values["dry-run"];

  // Resolve + validate every crosswalk entry against the NIC tree. seeded_at is
  // set explicitly (one timestamp per run) so re-seeds refresh it — the column
  // DEFAULT only fires on INSERT, not on the upsert's ON CONFLICT update.
  const seededAt = new Date().toISOString();
  const rows = SASB_NIC_CROSSWALK.map((e) => {
    const nic = resolveNic(e.division);
    if (!nic) throw new Error(`${e.code}: NIC division "${e.division}" is not a real NIC-2008 Division`);
    if (nic.sectionLetter !== e.section) {
      throw new Error(
        `${e.code}: division ${e.division} resolves to Section ${nic.sectionLetter} (${nic.sectionTitle}), but the map says Section ${e.section} — fix one`,
      );
    }
    return {
      industry_code: e.code,
      nic_section: nic.sectionLetter,
      nic_section_title: nic.sectionTitle,
      nic_division: nic.divisionCode,
      nic_division_title: nic.divisionTitle,
      confidence: e.confidence,
      seeded_at: seededAt,
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

  // Coverage check: the crosswalk must exactly match the stored industries.
  const { data: inds, error: indErr } = await supabase.from("sasb_industries").select("code");
  if (indErr) throw new Error(`could not list industries: ${indErr.message} — run sasb:scrape first?`);
  const dbCodes = new Set((inds ?? []).map((i: { code: string }) => i.code));
  const mapCodes = new Set(rows.map((r) => r.industry_code));
  const missing = [...dbCodes].filter((c) => !mapCodes.has(c)); // stored but not mapped
  const extra = [...mapCodes].filter((c) => !dbCodes.has(c)); // mapped but not stored
  if (missing.length) console.warn(`[crosswalk] ! ${missing.length} industry(ies) have NO crosswalk entry: ${missing.join(", ")}`);
  if (extra.length) console.warn(`[crosswalk] ! ${extra.length} crosswalk code(s) not in the DB (stale?): ${extra.join(", ")}`);

  if (dryRun) {
    console.log(`✓ dry-run — ${rows.length} entries, ${missing.length} uncovered, ${extra.length} stale — nothing written`);
    return;
  }

  const { error } = await supabase.from("sasb_industry_nic").upsert(rows, { onConflict: "industry_code" });
  if (error) throw new Error(`crosswalk upsert failed: ${error.message}`);
  console.log(`✓ crosswalk seeded — ${rows.length} entries upserted`);
}

main().catch((e) => {
  console.error("crosswalk seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
