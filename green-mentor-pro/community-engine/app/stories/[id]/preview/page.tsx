import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
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
 * M1: serves the hand-ported fixture issue (id = "fixture-issue-38") as the
 * fidelity benchmark. M2 extends this to community_stories drafts
 * (body_format = 'vismay').
 */
export default async function StoryPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  if (id !== ISSUE38_SLUG) notFound();

  const story = parseStoryContent(issue38Markdown);
  const config = parseStoryConfigText(ISSUE38_SLUG, issue38ConfigJson, "json");
  const { units, mobileUnits, hasMobileOverrides } = resolveUnits(
    ISSUE38_SLUG,
    story.sections,
    config
  );

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={gmFontImportUrl()} />
      <GmStoryReader
        slug={ISSUE38_SLUG}
        units={units}
        mobileUnits={hasMobileOverrides ? mobileUnits : undefined}
        defaults={config.defaults}
      />
    </>
  );
}
