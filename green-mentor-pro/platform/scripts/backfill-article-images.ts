/**
 * Backfill image_url for articles ingested before the og:image fallback existed.
 *
 *   node --env-file=.env.local --import tsx scripts/backfill-article-images.ts --dry-run
 *   node --env-file=.env.local --import tsx scripts/backfill-article-images.ts
 *
 * Flags: --dry-run (report only), --limit=N (default all), --concurrency=N (default 3).
 *
 * Concurrency is deliberately low and each page fetch retries on 429/503:
 * hammering one publisher with hundreds of requests gets you throttled, and a
 * throttled response looks exactly like "this article has no picture" unless
 * you handle it. edie started 429ing partway through the first real run.
 *
 * The original worker only looked for a picture inside the RSS item, so any
 * publisher who doesn't put one there produced null image_url rows — edie alone
 * left 142 articles rendering the gradient fallback. This walks those rows and
 * asks each article page for its Open Graph card, using the same helper the
 * worker now uses (lib/feed/images.ts).
 *
 * Safe to re-run: it only ever touches rows where image_url is still null.
 */
import { createAdminClient } from "../lib/supabase/admin";
import { ogImageFrom } from "../lib/feed/images";

type Row = { id: string; source: string; url: string };

const flag = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Number(flag("limit") ?? 0);
const CONCURRENCY = Math.max(1, Number(flag("concurrency") ?? 3));
const RETRIES = Math.max(0, Number(flag("retries") ?? 3));

/** Run `worker` over `items` with a fixed number of workers in flight. */
async function pooled<T>(items: T[], size: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        await worker(items[i]);
      }
    }),
  );
}

async function main() {
  const supabase = createAdminClient();

  let query = supabase
    .from("articles")
    .select("id, source, url")
    .is("image_url", null)
    .order("published_at", { ascending: false, nullsFirst: false });
  if (LIMIT > 0) query = query.limit(LIMIT);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) {
    console.log("Nothing to do — every article already has an image.");
    return;
  }

  console.log(
    `${rows.length} article(s) without an image${DRY_RUN ? " (dry run)" : ""} · concurrency ${CONCURRENCY}\n`,
  );

  const found = new Map<string, number>();
  const missed = new Map<string, number>();
  let failed = 0;

  await pooled(rows, CONCURRENCY, async (row) => {
    const image = await ogImageFrom(row.url, { retries: RETRIES });
    if (!image) {
      missed.set(row.source, (missed.get(row.source) ?? 0) + 1);
      return;
    }

    if (!DRY_RUN) {
      const { error: updateError } = await supabase.from("articles").update({ image_url: image }).eq("id", row.id);
      if (updateError) {
        failed++;
        console.error(`  ! ${row.id}: ${updateError.message}`);
        return;
      }
    }
    found.set(row.source, (found.get(row.source) ?? 0) + 1);
  });

  const sources = [...new Set([...found.keys(), ...missed.keys()])].sort();
  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  console.log(`${pad("SOURCE", 26)}${pad("RESOLVED", 10)}STILL MISSING`);
  console.log("-".repeat(52));
  for (const s of sources) {
    console.log(`${pad(s, 26)}${pad(found.get(s) ?? 0, 10)}${missed.get(s) ?? 0}`);
  }

  const total = [...found.values()].reduce((a, b) => a + b, 0);
  console.log(
    `\n${DRY_RUN ? "Would set" : "Set"} ${total} of ${rows.length} image(s)` +
      (failed ? ` · ${failed} update(s) failed` : ""),
  );
  if (DRY_RUN) console.log("Re-run without --dry-run to write.");
}

main().catch((e) => {
  console.error("backfill failed:", e?.message ?? e);
  process.exit(1);
});
