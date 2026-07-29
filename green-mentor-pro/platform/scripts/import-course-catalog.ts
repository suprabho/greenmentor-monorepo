/**
 * Import the course catalog from the intake sheet into public.course_catalog.
 *
 *   node --env-file=.env.local --import tsx scripts/import-course-catalog.ts [--file <path>] [--dry-run] [--prune]
 *
 * Reads scripts/data/course-catalog.csv (the committed copy of the Platform
 * Courses intake sheet), normalises every column, validates the whole batch
 * before touching the DB, and upserts on slug. Run after applying migration
 * 0027_course_catalog.sql.
 *
 * Rows whose Hosted On is the in-app player are additionally linked to their
 * public.courses row and used to refresh its title/description/level/status, so
 * the marketing card and the player never disagree about the same course.
 *
 * --prune archives DB rows whose slug is no longer in the sheet. Never deletes:
 * course_catalog.id will pick up references.
 */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createAdminClient } from "../lib/supabase/admin";
import { parseIntakeSheet } from "../lib/academy/catalog-intake";

/** courses.level predates the catalog and its check constraint has no 'foundation'. */
const PLAYER_LEVELS = new Set(["beginner", "intermediate", "advanced"]);

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  const { values } = parseArgs({
    args,
    options: {
      file: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      prune: { type: "boolean", default: false },
    },
  });
  const dryRun = values["dry-run"];
  const csvPath = values.file ? new URL(values.file, `file://${process.cwd()}/`) : new URL("./data/course-catalog.csv", import.meta.url);

  const { rows, overridden: overrides } = parseIntakeSheet(await readFile(csvPath, "utf8"));
  if (!rows.length) throw new Error(`no rows in ${csvPath.pathname}`);

  if (overrides.length) {
    console.log(`[catalog] included_in_plus OVERRIDE applied to ${overrides.length} row(s) whose sheet said "No": ${overrides.join(", ")}`);
  }

  const supabase = createAdminClient();

  // Link in-app rows to their player course, and flag any drift between the
  // sheet's counts and the real content tree.
  const inApp = rows.filter((r) => r.hosted_on === "in_app");
  if (inApp.length) {
    const { data: players, error: playerErr } = await supabase
      .from("courses")
      .select("id, slug, title, status")
      .in("slug", inApp.map((r) => r.slug));
    if (playerErr) throw new Error(`could not read public.courses: ${playerErr.message}`);
    const bySlug = new Map((players ?? []).map((c: { slug: string }) => [c.slug, c]));

    for (const row of inApp) {
      const player = bySlug.get(row.slug) as { id: string; title: string; status: string } | undefined;
      if (!player) {
        throw new Error(
          `${row.slug}: Hosted On says in-app but there is no public.courses row with that slug — ` +
            `run "npm run academy:import -- <drive-folder>" first, or point Hosted On at Learnyst`,
        );
      }
      row.course_id = player.id;
      if (player.status !== "published") console.warn(`[catalog] ! ${row.slug}: player course is status=${player.status}`);

      const { data: moduleRows } = await supabase.from("modules").select("id").eq("course_id", player.id);
      const ids = (moduleRows ?? []).map((m: { id: string }) => m.id);
      const modules = ids.length;
      const { count: lessons } = ids.length
        ? await supabase.from("lessons").select("id", { count: "exact", head: true }).in("module_id", ids)
        : { count: 0 };
      if (row.module_count !== null && modules !== row.module_count) {
        console.warn(`[catalog] ! ${row.slug}: sheet says ${row.module_count} modules, the player tree has ${modules}`);
      }
      if (row.lesson_count !== null && lessons !== row.lesson_count) {
        console.warn(`[catalog] ! ${row.slug}: sheet says ${row.lesson_count} lessons, the player tree has ${lessons}`);
      }
    }
  }

  // Rows in the DB that the sheet no longer lists.
  const { data: existing, error: existingErr } = await supabase.from("course_catalog").select("slug, status");
  if (existingErr) throw new Error(`could not read course_catalog: ${existingErr.message} — is 0027 applied?`);
  const sheetSlugs = new Set(rows.map((r) => r.slug));
  const stale = (existing ?? []).filter((r: { slug: string; status: string }) => !sheetSlugs.has(r.slug) && r.status !== "archived");
  if (stale.length) {
    const list = stale.map((r: { slug: string }) => r.slug).join(", ");
    console.warn(values.prune ? `[catalog] archiving ${stale.length} row(s) absent from the sheet: ${list}` : `[catalog] ! ${stale.length} row(s) in the DB are absent from the sheet (pass --prune to archive): ${list}`);
  }

  console.table(
    rows.map((r) => ({
      slug: r.slug,
      delivery: r.delivery,
      host: r.hosted_on,
      level: r.level,
      framework: r.framework,
      "₹": r.price_inr,
      plus: r.included_in_plus,
      lessons: r.lesson_count,
      cohort: r.next_cohort_at ?? "",
      status: r.status,
    })),
  );

  if (dryRun) {
    console.log(`✓ dry-run — ${rows.length} rows parsed, ${overrides.length} override(s), ${stale.length} stale — nothing written`);
    return;
  }

  const { error } = await supabase.from("course_catalog").upsert(rows, { onConflict: "slug" });
  if (error) throw new Error(`course_catalog upsert failed: ${error.message}`);
  console.log(`✓ course_catalog imported — ${rows.length} rows upserted`);

  if (values.prune && stale.length) {
    const { error: pruneErr } = await supabase
      .from("course_catalog")
      .update({ status: "archived" })
      .in("slug", stale.map((r: { slug: string }) => r.slug));
    if (pruneErr) throw new Error(`prune failed: ${pruneErr.message}`);
    console.log(`✓ archived ${stale.length} stale row(s)`);
  }

  // Keep the player row in step with the sheet for in-app courses.
  for (const row of inApp) {
    const patch: Record<string, unknown> = {
      title: row.title,
      description: row.description,
      // courses.level predates the catalog and its check has no 'foundation'.
      level: PLAYER_LEVELS.has(row.level) ? row.level : "beginner",
      status: row.status === "published" ? "published" : "draft",
      updated_at: new Date().toISOString(),
    };
    // A free course is 0 credits. Any other rupee price says nothing about the
    // in-app credit price, so leave price_credits alone.
    if (row.price_inr === 0) patch.price_credits = 0;

    const { error: courseErr } = await supabase.from("courses").update(patch).eq("slug", row.slug);
    if (courseErr) throw new Error(`could not refresh public.courses for ${row.slug}: ${courseErr.message}`);
    console.log(`✓ refreshed public.courses row for ${row.slug}`);
  }
}

main().catch((e) => {
  console.error("course catalog import failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
