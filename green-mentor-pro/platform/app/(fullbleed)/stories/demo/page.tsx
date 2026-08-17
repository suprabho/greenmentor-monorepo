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

/**
 * M1 demo: the hand-ported fixture issue rendered through the full
 * scrollytelling stack (parse → resolveUnits → StoryShell + gm:* vertical).
 * Replaced by /stories/[slug] against `stories_public` in M4.
 */
export const metadata = {
  title: "A Wake-Up Call for Indian Business — Story demo",
};

export default function StoryDemoPage() {
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
