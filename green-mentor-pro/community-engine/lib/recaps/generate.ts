/**
 * Weekly ESG recap generator — shared verbatim by the on-demand API route and
 * the scheduled worker script (which is why every import here is relative and
 * Node-safe: no Next.js, no path aliases).
 *
 * Inputs: the last 7 days of pipeline-ingested articles (already AI-summarized
 * and entity-tagged) plus optional admin-curated URLs (SSRF-guarded fetch +
 * readability extraction — the same path a story's link source takes). One
 * forced-tool Claude call derives 5-8 news-driven topics, each tagged with
 * exactly one category of the fixed conceptual framework.
 *
 * The model owns topic analysis; code owns the data: source references are
 * resolved to real titles/urls after generation, unresolvable ones are
 * dropped, and every citation list in the stored markdown is built by code.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchGuarded } from "../security/urlGuard";
import { extractHtmlBody } from "../stories/source-extract";
import { htmlToPlainText } from "../stories/compose";
import { fetchShareCardArticles } from "../share-cards/articles";
import { insertRecap, type RecapRow, type RecapSourceRef, type RecapTopic } from "../db/recaps";
import { RECAP_FRAMEWORK, RECAP_CATEGORY_IDS, type RecapCategoryId } from "./framework";
import { buildRecapMarkdown } from "./markdown";

/** Feed articles offered to the model (summaries are ≤60 words each). */
const MAX_ARTICLES = 120;
/** Curated pages fetched per run. */
const MAX_CURATED_URLS = 10;
/** Per-page clip for curated URL text, mirroring buildSourcesContext's budget. */
const MAX_CURATED_CHARS = 6_000;
/** A thin week still yields a usable recap; below this the model is padding. */
const MIN_TOPICS = 3;
const RECAP_WINDOW_DAYS = 7;

const inputSchema: Anthropic.Messages.Tool["input_schema"] = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      description:
        "Recap headline under 80 chars capturing the week's through-line, e.g. 'EU simplification meets US fragmentation'.",
    },
    topics: {
      type: "array",
      description: "5 to 8 distinct topics, most consequential first.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", description: "Punchy topic title, under 80 chars." },
          category: {
            type: "string",
            enum: RECAP_CATEGORY_IDS,
            description: "The ONE framework category this topic belongs to.",
          },
          summary: {
            type: "string",
            description:
              "2-3 sentence thesis: what happened this week and why a sustainability practitioner should care.",
          },
          keyFacts: {
            type: "array",
            items: { type: "string" },
            description: "2-4 concrete facts (dates, figures, named rules) drawn from the sources.",
          },
          sourceIds: {
            type: "array",
            items: { type: "string" },
            description:
              "Ids of the input sources this topic is grounded in, e.g. [\"A12\", \"U2\"]. At least one.",
          },
        },
        required: ["title", "category", "summary", "keyFacts", "sourceIds"],
      },
    },
  },
  required: ["title", "topics"],
};

interface CuratedPage {
  id: string;
  url: string;
  title: string;
  text: string;
}

function buildSystemPrompt(): string {
  const framework = RECAP_FRAMEWORK.map(
    (c) => `- ${c.id} — ${c.name}: ${c.whyItMatters} (anchors: ${c.anchorSources.join("; ")})`
  ).join("\n");
  return (
    `You are the editor of GreenMentor's weekly ESG recap — an educational digest for sustainability ` +
    `practitioners. From the week's source material below, derive 5-8 distinct topics worth teaching this week.\n\n` +
    `Organize with this fixed conceptual framework. Each topic is tagged with exactly ONE category id; ` +
    `use the category's stakes to frame why the topic matters. Only categories with real news this week ` +
    `should appear — never invent a topic to fill a category.\n\n${framework}\n\n` +
    `Rules:\n` +
    `- Ground every topic in the sources: cite at least one source id per topic and do not state facts absent from them.\n` +
    `- Topics must not overlap; merge related items into one topic with multiple sources.\n` +
    `- Prefer developments with regulatory, market, or career consequences over incremental news.\n` +
    `- Write for a practitioner audience: concrete rules, deadlines, and numbers over vibes.\n` +
    `Call emit_recap.`
  );
}

function renderInputs(
  articles: Awaited<ReturnType<typeof fetchShareCardArticles>>,
  pages: CuratedPage[]
): string {
  const blocks: string[] = [];
  if (pages.length > 0) {
    blocks.push("CURATED PAGES (full text, clipped):");
    for (const p of pages) {
      blocks.push(`[${p.id}] ${p.title} (${p.url}):\n${p.text}`);
    }
  }
  if (articles.length > 0) {
    blocks.push("THIS WEEK'S INGESTED ARTICLES (AI summaries):");
    for (let i = 0; i < articles.length; i++) {
      const a = articles[i];
      const entities = a.entities.map((e) => e.name).join(", ");
      const date = a.published_at ? a.published_at.slice(0, 10) : "n.d.";
      blocks.push(
        `[A${i + 1}] ${a.title} (${a.source}, ${date}): ${a.summary ?? "(no summary)"}${
          entities ? ` — entities: ${entities}` : ""
        }`
      );
    }
  }
  return blocks.join("\n\n");
}

async function fetchCuratedPages(
  urls: string[],
  warnings: string[]
): Promise<CuratedPage[]> {
  const pages: CuratedPage[] = [];
  for (const raw of urls.slice(0, MAX_CURATED_URLS)) {
    const url = raw.trim();
    if (!url) continue;
    const id = `U${pages.length + 1}`;
    try {
      const result = await fetchGuarded(url, { accept: "text/html" });
      if (!result.ok) {
        warnings.push(`Skipped ${url}: ${result.message}`);
        continue;
      }
      const upstream = result.response;
      const contentType = upstream.headers.get("content-type") ?? "";
      if (!upstream.ok || !contentType.startsWith("text/html")) {
        warnings.push(
          `Skipped ${url}: ${!upstream.ok ? `upstream ${upstream.status}` : "not an HTML page"}`
        );
        continue;
      }
      const html = await upstream.text();
      const text = (await extractHtmlBody(html, htmlToPlainText)) ?? "";
      if (!text) {
        warnings.push(`Skipped ${url}: no text content found`);
        continue;
      }
      const titleMatch = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i);
      pages.push({
        id,
        url,
        title: titleMatch ? htmlToPlainText(titleMatch[1]).trim() || url : url,
        text: text.slice(0, MAX_CURATED_CHARS),
      });
    } catch (e) {
      warnings.push(`Skipped ${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return pages;
}

export interface GenerateRecapResult {
  recap: RecapRow;
  /** Curated URLs that couldn't be fetched/read — surfaced, never fatal. */
  warnings: string[];
}

export async function generateRecap(
  client: SupabaseClient,
  opts: { urls?: string[]; createdBy?: string | null } = {}
): Promise<GenerateRecapResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const now = new Date();
  const since = new Date(now.getTime() - RECAP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const periodStart = since.toISOString().slice(0, 10);
  const periodEnd = now.toISOString().slice(0, 10);

  const warnings: string[] = [];
  const [articles, pages] = await Promise.all([
    fetchShareCardArticles(client, { since: since.toISOString(), limit: MAX_ARTICLES }),
    fetchCuratedPages(opts.urls ?? [], warnings),
  ]);

  if (articles.length < 5 && pages.length === 0) {
    throw new Error(
      `Not enough material: only ${articles.length} articles ingested in the last ${RECAP_WINDOW_DAYS} days and no curated URLs readable.`
    );
  }

  const model = process.env.RECAP_MODEL ?? "claude-sonnet-5";
  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model,
    // 8 topics of tool-call JSON (summaries + keyFacts) can overrun 4096,
    // and a truncated forced tool call surfaces as an empty topics array.
    max_tokens: 8192,
    system: buildSystemPrompt(),
    tools: [
      {
        name: "emit_recap",
        description: "Return the weekly recap's topics.",
        strict: true,
        input_schema: inputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "emit_recap" },
    messages: [{ role: "user", content: renderInputs(articles, pages) }],
  });

  if (message.stop_reason === "max_tokens") {
    throw new Error("Recap response was truncated at max_tokens — raise the limit or trim inputs");
  }
  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return a recap");
  }
  const raw = toolUse.input as {
    title: string;
    topics: {
      title: string;
      category: string;
      summary: string;
      keyFacts: string[];
      sourceIds: string[];
    }[];
  };

  // Resolve source ids to real refs; a topic that cites nothing resolvable, or
  // an unknown category, is dropped rather than repaired — invented grounding
  // is worse than a shorter recap.
  const topics: RecapTopic[] = [];
  for (const t of raw.topics ?? []) {
    if (!RECAP_CATEGORY_IDS.includes(t.category as RecapCategoryId)) {
      warnings.push(`Dropped topic "${t.title}": unknown category '${t.category}'`);
      continue;
    }
    const refs: RecapSourceRef[] = [];
    for (const sid of t.sourceIds ?? []) {
      const articleMatch = /^A(\d+)$/.exec(sid.trim());
      const pageMatch = /^U(\d+)$/.exec(sid.trim());
      if (articleMatch) {
        const a = articles[Number(articleMatch[1]) - 1];
        if (a && !refs.some((r) => r.url === a.url)) {
          refs.push({ type: "article", id: a.id, title: a.title, url: a.url });
        }
      } else if (pageMatch) {
        const p = pages[Number(pageMatch[1]) - 1];
        if (p && !refs.some((r) => r.url === p.url)) {
          refs.push({ type: "url", url: p.url, title: p.title });
        }
      }
    }
    if (refs.length === 0) {
      warnings.push(`Dropped topic "${t.title}": no resolvable sources`);
      continue;
    }
    topics.push({
      id: `t${topics.length + 1}`,
      title: t.title,
      category: t.category as RecapCategoryId,
      summary: t.summary,
      keyFacts: (t.keyFacts ?? []).filter(Boolean),
      sourceRefs: refs,
    });
  }

  if (topics.length < MIN_TOPICS) {
    throw new Error(
      `Only ${topics.length} usable topics came back (need ${MIN_TOPICS}+). ${warnings.join(" | ") || ""}`.trim()
    );
  }

  const title = raw.title?.trim() || `Weekly ESG recap — ${periodEnd}`;
  const markdown = buildRecapMarkdown({
    title,
    period_start: periodStart,
    period_end: periodEnd,
    topics,
  });

  const recap = await insertRecap(client, {
    title,
    period_start: periodStart,
    period_end: periodEnd,
    markdown,
    topics,
    curated_urls: pages.map((p) => ({ url: p.url, title: p.title })),
    article_ids: articles.map((a) => a.id),
    model,
    created_by: opts.createdBy ?? null,
  });

  return { recap, warnings };
}
