import { parseStoryContent } from "@vismay/content-source/content";
import { parseStoryConfigText } from "@vismay/content-source/storyConfig";
import { resolveUnits } from "@vismay/content-source/resolveUnits";
import { resolveAnchor } from "@vismay/content-source/contentAnchors";
import { lintGmStory } from "@gm/story-vertical/lint";

/**
 * Full dry-run of the reader path over a vismay story document pair:
 * frontmatter+markdown parse, config parse+validate, unit resolution
 * (catches config `text:` anchors that no longer match a markdown heading),
 * then the GreenMentor house-style lint. Server-only (resolveUnits' import
 * chain reaches content-source internals).
 *
 * Hard failures (unparseable / unresolvable) → { ok: false }; the document
 * must not be saved or published in that state. Lint findings are advisory.
 */
export type GmDocumentValidation =
  | { ok: true; warnings: string[] }
  | { ok: false; error: string };

export function validateGmStoryDocument(
  slug: string,
  markdown: string,
  configJson: string
): GmDocumentValidation {
  try {
    const story = parseStoryContent(markdown);
    const config = parseStoryConfigText(slug, configJson, "json");

    // Anchor integrity is a HARD error here even though the engine itself
    // only warns: resolveUnits renders a missing anchor as an empty unit,
    // which reads as silent content loss in the published story.
    const missing: string[] = [];
    config.sections.forEach((section, i) => {
      if (section.text && !resolveAnchor(story.sections, section.text)) {
        missing.push(`section ${i}: "${section.text}"`);
      }
      section.subsections?.forEach((sub, j) => {
        if (sub.text && !resolveAnchor(story.sections, sub.text)) {
          missing.push(`section ${i} subsection ${j}: "${sub.text}"`);
        }
      });
    });
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Config anchors with no matching markdown heading — ${missing.join("; ")}`,
      };
    }

    resolveUnits(slug, story.sections, config);
    const warnings = lintGmStory(config).map((issue) =>
      issue.sectionIndex !== undefined
        ? `[section ${issue.sectionIndex}] ${issue.message}`
        : issue.message
    );
    return { ok: true, warnings };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
