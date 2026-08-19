/**
 * generate-recap.ts — the weekly-recap worker (.github/workflows/weekly-recap.yml).
 *
 * Distills the last 7 days of pipeline-ingested ESG articles into a cited
 * multi-topic recap row in `community_recaps`. Feed-only by design: the cron
 * has no admin to paste curated URLs — those come through the on-demand
 * POST /api/recaps path instead.
 *
 * Env (see the workflow / .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL    - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   - service-role key (worker writes, bypasses RLS)
 *   ANTHROPIC_API_KEY           - Claude API key
 *   RECAP_MODEL                 - optional model override
 *
 * Usage:
 *   pnpm --filter green-mentor-pro-community-engine recap:generate           # local (.env.local)
 *   pnpm --filter green-mentor-pro-community-engine recap:generate -- --dry  # print, don't insert
 */

import { createAdminClient } from "../lib/supabase/admin";
import { generateRecap } from "../lib/recaps/generate";
import { buildRecapMarkdown } from "../lib/recaps/markdown";

const dry = process.argv.includes("--dry");

async function main() {
  const client = createAdminClient();

  if (dry) {
    // Dry runs still read articles + call the model, but skip the insert by
    // pointing generateRecap at a stub whose insert echoes its input back.
    const stub = {
      from: (table: string) => {
        if (table !== "community_recaps") return client.from(table);
        return {
          insert: (input: Record<string, unknown>) => ({
            select: () => ({
              single: async () => ({
                data: { id: "dry-run", generated_at: "", created_at: "", status: "complete", error: null, ...input },
                error: null,
              }),
            }),
          }),
        };
      },
    } as unknown as ReturnType<typeof createAdminClient>;

    const { recap, warnings } = await generateRecap(stub);
    console.log(buildRecapMarkdown(recap));
    for (const w of warnings) console.warn(`warning: ${w}`);
    console.log(`\n[dry] ${recap.topics.length} topics; nothing inserted.`);
    return;
  }

  const { recap, warnings } = await generateRecap(client);
  for (const w of warnings) console.warn(`warning: ${w}`);
  console.log(
    `Inserted recap ${recap.id}: "${recap.title}" — ${recap.topics.length} topics, ` +
      `${recap.article_ids.length} articles read (${recap.period_start} → ${recap.period_end}).`
  );
}

main().catch((e) => {
  console.error(`Recap generation failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
