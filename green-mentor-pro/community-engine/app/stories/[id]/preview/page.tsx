import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { getStory } from "@/lib/db/stories";
import { parseStoryContent } from "@vismay/content-source/content";
import { parseStoryConfigText } from "@vismay/content-source/storyConfig";
import { resolveUnits } from "@vismay/content-source/resolveUnits";
import { gmFontImportUrl } from "@gm/story-vertical/theme";
import {
  ISSUE38_SLUG,
  issue38ConfigJson,
  issue38Markdown,
} from "@gm/story-vertical/fixtures/issue38";
import GmStoryReader from "@/components/stories/GmStoryReader";

export const dynamic = "force-dynamic";

/**
 * Chrome-less scrollytelling preview of a story draft, embedded as an iframe
 * by the story editor (and openable directly). Deliberately outside the
 * (shell) group — StoryShell owns the whole viewport.
 *
 * `fixture-issue-38` serves the hand-ported fixture issue (the M1 fidelity
 * benchmark); any other id loads a community_stories draft with
 * body_format = 'vismay'.
 */
async function loadDocument(
  id: string
): Promise<{ slug: string; markdown: string; configJson: string } | null> {
  if (id === ISSUE38_SLUG) {
    return { slug: ISSUE38_SLUG, markdown: issue38Markdown, configJson: issue38ConfigJson };
  }
  if (!isServiceRoleConfigured()) return null;
  const story = await getStory(createAdminClient(), id);
  if (!story || story.body_format !== "vismay" || !story.body_markdown || !story.config_json) {
    return null;
  }
  return { slug: story.id, markdown: story.body_markdown, configJson: story.config_json };
}

export default async function StoryPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const doc = await loadDocument(id);
  if (!doc) notFound();

  const story = parseStoryContent(doc.markdown);
  const config = parseStoryConfigText(doc.slug, doc.configJson, "json");
  const { units, mobileUnits, hasMobileOverrides } = resolveUnits(
    doc.slug,
    story.sections,
    config
  );

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={gmFontImportUrl()} />
      <GmStoryReader
        slug={doc.slug}
        units={units}
        mobileUnits={hasMobileOverrides ? mobileUnits : undefined}
        defaults={config.defaults}
      />
    </>
  );
}
