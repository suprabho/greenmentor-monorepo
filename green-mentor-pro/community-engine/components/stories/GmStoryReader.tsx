"use client";

/**
 * Client shell for the GreenMentor scrollytelling reader.
 *
 * The viz-module registry is a per-bundle singleton, so the gm:* vertical
 * must be (re)registered on the client before StoryShell's slots call
 * getVizModule — that's what the module-scope registerVerticalLoader +
 * <VerticalLoader vertical="greenmentor"> boundary does (vismay contract).
 */

import { registerVerticalLoader, VerticalLoader } from "@vismay/viz-engine";
import type { ResolvedUnit, StoryDefaults } from "@vismay/viz-engine";
import { StoryShell, ThemeProvider } from "@vismay/story-reader";
import { GREENMENTOR_THEME } from "@gm/story-vertical/theme";

registerVerticalLoader("greenmentor", () =>
  import("@gm/story-vertical").then((m) => m.register())
);

export default function GmStoryReader({
  slug,
  units,
  mobileUnits,
  defaults,
}: {
  slug: string;
  units: ResolvedUnit[];
  mobileUnits?: ResolvedUnit[];
  defaults: StoryDefaults;
}) {
  return (
    <ThemeProvider theme={GREENMENTOR_THEME}>
      <VerticalLoader vertical="greenmentor">
        <StoryShell
          slug={slug}
          units={units}
          mobileUnits={mobileUnits}
          defaults={defaults}
          format="deck"
          accessToken=""
        />
      </VerticalLoader>
    </ThemeProvider>
  );
}
