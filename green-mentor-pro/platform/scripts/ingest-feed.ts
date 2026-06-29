/**
 * ESG Feed ingestion worker (footshorts pattern, reimplemented for ESG).
 *
 *   node --env-file=.env.local --import tsx scripts/ingest-feed.ts
 *
 * For each RSS source: fetch → parse items → for new URLs, summarize + entity-tag
 * via Claude Haiku → upsert articles + entities + links. Writes use the
 * service-role client, so SUPABASE_SERVICE_ROLE_KEY + ANTHROPIC_API_KEY must be set.
 *
 * The plan's preferred summarizer is @vismay/ai-gateway (Gemini Flash); this uses
 * the Anthropic key already on disk. Swap the model in summarizeAndTag to switch.
 */
import Anthropic from "@anthropic-ai/sdk";
import { getClient } from "@gm/agents";
import { createAdminClient } from "../lib/supabase/admin";
import { RSS_SOURCES, KNOWN_ENTITIES, type RssSource } from "../lib/feed-sources";

const SUMMARY_MODEL = process.env.FEED_SUMMARY_MODEL ?? "claude-haiku-4-5";
const PER_SOURCE = Number(process.env.FEED_PER_SOURCE ?? 6);

type Item = { title: string; link: string; pubDate?: string; description?: string };

const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&")
    .trim();
}
function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? decode(m[1]) : undefined;
}

/** Minimal RSS + Atom item parser (good enough for syndication feeds). */
function parseFeed(xml: string): Item[] {
  const isAtom = /<entry[\s>]/i.test(xml) && !/<item[\s>]/i.test(xml);
  const splitTag = isAtom ? "entry" : "item";
  const blocks = xml.split(new RegExp(`<${splitTag}[\\s>]`, "i")).slice(1)
    .map((b) => b.split(new RegExp(`</${splitTag}>`, "i"))[0]);

  return blocks.map((b) => {
    const title = tag(b, "title") ?? "";
    let link = tag(b, "link") ?? "";
    if (isAtom) {
      const href = b.match(/<link[^>]*href="([^"]+)"/i);
      if (href) link = href[1];
    }
    return {
      title: stripTags(title),
      link: link.trim(),
      pubDate: tag(b, "pubDate") ?? tag(b, "updated") ?? tag(b, "published"),
      description: stripTags(tag(b, "description") ?? tag(b, "summary") ?? tag(b, "content") ?? "").slice(0, 1200),
    };
  }).filter((i) => i.title && i.link);
}

type CardResult = {
  relevant: boolean;
  summary: string;
  entities: { slug: string; name: string; kind: "framework" | "topic" | "region" | "company" }[];
};

async function summarizeAndTag(item: Item): Promise<CardResult | null> {
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
    const res = await fetch(source.feedUrl, { headers: { "user-agent": "GreenMentorPro/0.1 feed-worker" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } catch (e) {
    console.error(`[${source.id}] fetch failed:`, e instanceof Error ? e.message : e);
    return { added: 0 };
  }

  const items = parseFeed(xml).slice(0, PER_SOURCE);
  const urls = items.map((i) => i.link);
  const { data: existing } = await supabase.from("articles").select("url").in("url", urls);
  const seen = new Set((existing ?? []).map((r) => r.url));

  let added = 0;
  for (const item of items) {
    if (seen.has(item.link)) continue;
    const card = await summarizeAndTag(item);
    if (!card || !card.relevant) continue;

    const { data: article, error } = await supabase
      .from("articles")
      .insert({
        source: source.publisher,
        title: item.title,
        url: item.link,
        summary: card.summary,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
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
    console.log(`[${source.id}] + ${item.title.slice(0, 70)}`);
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
