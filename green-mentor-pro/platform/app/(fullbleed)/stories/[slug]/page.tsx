import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { parseStoryContent } from "@vismay/content-source/content";
import { parseStoryConfigText } from "@vismay/content-source/storyConfig";
import { resolveUnits } from "@vismay/content-source/resolveUnits";
import { gmFontImportUrl } from "@gm/story-vertical/theme";
import { resolveStory, storyHref } from "@/lib/stories/repo";
import { shareMetadata } from "@/lib/share/og";
import GmStoryReader from "@/components/stories/GmStoryReader";

export const dynamic = "force-dynamic";

/**
 * Public scrollytelling reader. Renders the published snapshot from
 * stories_public through the same engine stack as the CE preview
 * (parse → resolveUnits → StoryShell + gm:* vertical) — fullbleed group,
 * StoryShell owns the viewport. Public by design (like /webinars, /jobs):
 * stories are the shareable top-of-funnel surface.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const story = await resolveStory(slug);
  if (!story) return {};
  return shareMetadata({
    title: story.title,
    description: story.subtitle,
    path: storyHref(story),
    image: story.coverImageUrl,
    badge: "Story",
    subtitle: story.byline,
    type: "article",
    publishedTime: story.publishedAt,
  });
}

export default async function PublicStoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const story = await resolveStory(slug);
  if (!story) notFound();

  // Canonicalize stale slugs and bare-uuid links (same contract as jobs/webinars).
  if (decodeURIComponent(slug) !== story.shareSlug) {
    permanentRedirect(storyHref(story));
  }

  const parsed = parseStoryContent(story.markdown);
  const config = parseStoryConfigText(story.shareSlug, story.configJson, story.configFormat);
  const { units, mobileUnits, hasMobileOverrides } = resolveUnits(
    story.shareSlug,
    parsed.sections,
    config
  );

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={gmFontImportUrl()} />
      {/* slug = the share segment: GenericChart fetches
          /api/chart-data/<shareSlug>/<chartId>, whose publication branch
          serves this story's chart snapshot. */}
      <GmStoryReader
        slug={story.shareSlug}
        units={units}
        mobileUnits={hasMobileOverrides ? mobileUnits : undefined}
        defaults={config.defaults}
      />
    </>
  );
}
