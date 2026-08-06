/**
 * ESG Feed ingestion worker (footshorts pattern, reimplemented for ESG).
 *
 *   ANTHROPIC_API_KEY=… node --env-file=.env.local --import tsx scripts/ingest-feed.ts
 *
 * For each RSS source: fetch → parse items → drop obvious noise → for new URLs,
 * summarize + entity-tag via Claude Haiku → find a thumbnail → upsert articles
 * + entities + links. Writes use the service-role client, so
 * SUPABASE_SERVICE_ROLE_KEY + ANTHROPIC_API_KEY must be set.
 *
 * Parsing lives in lib/feed/rss.ts and thumbnail discovery in lib/feed/images.ts,
 * both shared with scripts/backfill-article-images.ts and unit-tested.
 */
import Anthropic from "@anthropic-ai/sdk";
import { getClient } from "@gm/agents";
import { createAdminClient } from "../lib/supabase/admin";
import { RSS_SOURCES, KNOWN_ENTITIES, looksEsgRelevant, type RssSource } from "../lib/feed-sources";
import { FEED_USER_AGENT, ogImageFrom } from "../lib/feed/images";
import { parseFeed, type FeedItem } from "../lib/feed/rss";

const SUMMARY_MODEL = process.env.FEED_SUMMARY_MODEL ?? "claude-haiku-4-5";
const PER_SOURCE = Number(process.env.FEED_PER_SOURCE ?? 6);

type CardResult = {
  relevant: boolean;
  summary: string;
  entities: { slug: string; name: string; kind: "framework" | "topic" | "region" | "company" }[];
};

async function summarizeAndTag(item: FeedItem): Promise<CardResult | null> {
  const client = getClient();
  const vocab = KNOWN_ENTITIES.map((e) => `${e.slug} (${e.name}, ${e.kind})`).join("; ");
  const tool: Anthropic.Messages.Tool = {
    name: "emit_card",
    description: "Emit the curated ESG feed card for this news item.",
    input_schema: {
      type: "object",
      properties: {
        relevant: { type: "boolean", description: "true only if about ESG/sustainability/climate/reporting/regulation" },
        summary: { type: "string", description: "<= 60 words, neutral, no invented figures" },
        entities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              slug: { type: "string" },
              name: { type: "string" },
              kind: { type: "string", enum: ["framework", "topic", "region", "company"] },
            },
            required: ["slug", "name", "kind"],
          },
        },
      },
      required: ["relevant", "summary", "entities"],
    },
  };

  const msg = await client.messages.create({
    model: SUMMARY_MODEL,
    max_tokens: 700,
    system:
      "You curate an ESG/sustainability news feed. Summarize the item in <=60 words, neutral and specific, never inventing figures. " +
      "Tag it with entities, preferring this controlled vocabulary where it clearly applies: " + vocab + ". " +
      "You may add a company or topic slug (kebab-case) if it's central. Set relevant=false for non-ESG items.",
    tools: [tool],
    tool_choice: { type: "tool", name: "emit_card" },
    messages: [{ role: "user", content: `TITLE: ${item.title}\n\nEXCERPT: ${item.description ?? ""}` }],
  });

  const use = msg.content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use");
  return (use?.input as CardResult) ?? null;
}

async function ingestSource(supabase: ReturnType<typeof createAdminClient>, source: RssSource) {
  let xml: string;
  try {
    const res = await fetch(source.feedUrl, { headers: { "user-agent": FEED_USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } catch (e) {
    console.error(`[${source.id}] fetch failed:`, e instanceof Error ? e.message : e);
    return { added: 0 };
  }

  const parsed = parseFeed(xml);
  if (parsed.length === 0) {
    // A feed that 200s with zero items is almost always dead (moved, rebranded,
    // or serving an HTML error page). Say so loudly — this failed silently for
    // months on GreenBiz. `pnpm feed:check` exists to catch it earlier.
    console.warn(`[${source.id}] feed returned no items — check ${source.feedUrl}`);
    return { added: 0 };
  }

  // Broad or off-beat feeds (regulators, general business desks) get a keyword
  // gate before we spend a summarizer call on each item.
  const candidates = source.strict
    ? parsed.filter((i) => looksEsgRelevant(`${i.title} ${i.description ?? ""}`))
    : parsed;

  const items = candidates.slice(0, PER_SOURCE);
  const urls = items.map((i) => i.link);
  const { data: existing } = await supabase.from("articles").select("url").in("url", urls);
  const seen = new Set((existing ?? []).map((r) => r.url));

  let added = 0;
  for (const item of items) {
    if (seen.has(item.link)) continue;
    const card = await summarizeAndTag(item);
    if (!card || !card.relevant) continue;

    // Only now, once we know the article is going in, is it worth a second
    // request for the publisher's og:image. Plenty of feeds (edie, SEBI, most
    // wire copy) carry no picture in the item itself.
    const image = item.image ?? (await ogImageFrom(item.link)) ?? null;

    const { data: article, error } = await supabase
      .from("articles")
      .insert({
        source: source.publisher,
        region: source.region,
        title: item.title,
        url: item.link,
        summary: card.summary,
        image_url: image,
        published_at: item.publishedAt,
      })
      .select("id")
      .single();
    if (error || !article) {
      console.error(`[${source.id}] insert failed: ${error?.message}`);
      continue;
    }

    for (const e of card.entities.slice(0, 6)) {
      const { data: ent } = await supabase
        .from("entities")
        .upsert({ slug: e.slug, name: e.name, kind: e.kind }, { onConflict: "slug" })
        .select("id")
        .single();
      if (ent) await supabase.from("article_entities").insert({ article_id: article.id, entity_id: ent.id });
    }
    added++;
    console.log(`[${source.id}] +${image ? "" : " (no image)"} ${item.title.slice(0, 70)}`);
  }
  return { added };
}

async function main() {
  const supabase = createAdminClient();
  let total = 0;
  for (const source of RSS_SOURCES) {
    const { added } = await ingestSource(supabase, source);
    total += added;
    console.log(`[${source.id}] done — ${added} new`);
  }
  console.log(`\n✓ ingestion complete — ${total} new articles`);
}

main().catch((e) => {
  console.error("ingestion failed:", e?.message ?? e);
  process.exit(1);
});
