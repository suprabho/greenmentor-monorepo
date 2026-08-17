import { parseStoryContent } from "@vismay/content-source/content";
import { parseStoryConfigText } from "@vismay/content-source/storyConfig";
import { resolveUnits } from "@vismay/content-source/resolveUnits";
import { gmFontImportUrl } from "@gm/story-vertical/theme";
import {
  ALL_MODULES_SLUG,
  allModulesConfigJson,
  allModulesMarkdown,
} from "@gm/story-vertical/fixtures/allModules";
import GmStoryReader from "@/components/stories/GmStoryReader";

/**
 * Module-gallery demo: the all-modules fixture rendered through the full
 * scrollytelling stack. One scroll covers every gm:* module (including the
 * ones issue38 doesn't reach) — the deterministic rendering benchmark that
 * isolates renderer issues from compose-pipeline issues.
 */
export const metadata = {
  title: "Every Module, One Story — gm module gallery",
};

export default function StoryDemoAllModulesPage() {
  const story = parseStoryContent(allModulesMarkdown);
  const config = parseStoryConfigText(ALL_MODULES_SLUG, allModulesConfigJson, "json");
  const { units, mobileUnits, hasMobileOverrides } = resolveUnits(
    ALL_MODULES_SLUG,
    story.sections,
    config
  );

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={gmFontImportUrl()} />
      <GmStoryReader
        slug={ALL_MODULES_SLUG}
        units={units}
        mobileUnits={hasMobileOverrides ? mobileUnits : undefined}
        defaults={config.defaults}
      />
    </>
  );
}
