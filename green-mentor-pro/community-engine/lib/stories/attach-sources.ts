/**
 * Shared source-attach paths: a pipeline article (already ingested +
 * summarized, no live fetch) and a link (SSRF-guarded fetch + readability
 * extraction). Factored out of the compose sources route so the recap-topic
 * route can attach a chosen topic's grounding sources through the exact same
 * code — same failure semantics: a fetch/parse failure still inserts a
 * visible `status: "failed"` row rather than throwing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { insertStorySource, type StorySourceRow } from "@/lib/db/story-sources";
import { fetchGuarded } from "@/lib/security/urlGuard";
import { htmlToPlainText } from "@/lib/stories/compose";
import { fetchShareCardArticles } from "@/lib/share-cards/articles";
import { extractHtmlBody } from "@/lib/stories/source-extract";

/** Attach an ingested pipeline article as a source. Returns null when the
 *  article doesn't exist (the route turns that into a 404). */
export async function attachPipelineArticleSource(
  client: SupabaseClient,
  storyId: string,
  articleId: string
): Promise<StorySourceRow | null> {
  const [article] = await fetchShareCardArticles(client, { ids: [articleId] });
  if (!article) return null;

  return insertStorySource(client, {
    story_id: storyId,
    kind: "pipeline",
    title: article.title,
    url: article.url,
    extracted_text: article.summary,
    status: article.summary ? "extracted" : "failed",
    error: article.summary ? null : "Article has no summary yet",
  });
}

/** Fetch + extract a link and record it as a source; failures become rows. */
export async function attachLinkSource(
  client: SupabaseClient,
  storyId: string,
  url: string,
  title?: string | null
): Promise<StorySourceRow> {
  const result = await fetchGuarded(url, { accept: "text/html" });
  if (!result.ok) {
    return insertStorySource(client, {
      story_id: storyId,
      kind: "link",
      title: title?.trim() || url,
      url,
      status: "failed",
      error: result.message,
    });
  }

  const upstream = result.response;
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !contentType.startsWith("text/html")) {
    return insertStorySource(client, {
      story_id: storyId,
      kind: "link",
      title: title?.trim() || url,
      url,
      status: "failed",
      error: !upstream.ok ? `Upstream ${upstream.status}` : "Not an HTML page",
    });
  }

  const html = await upstream.text();
  const extracted = await extractHtmlBody(html, htmlToPlainText);
  return insertStorySource(client, {
    story_id: storyId,
    kind: "link",
    title: title?.trim() || url,
    url,
    extracted_text: extracted,
    status: extracted ? "extracted" : "failed",
    error: extracted ? null : "No text content found",
  });
}
