import { getVizModule, registerVizModule, type VizModule } from "@vismay/viz-engine";
import storyChartModule from "./chart";
import storyHeroModule from "./hero";
import storyImageModule from "./image";
import storyPullquoteModule from "./pullquote";
import storyCtaModule from "./cta";
import storyCalloutModule from "./callout";

/**
 * Register the Stories module family (`story:*`) into the shared viz-engine
 * registry. Idempotent (guards on getVizModule) — the registry throws on
 * double-register and this runs on every StoryBody mount / HMR reload.
 * Mirrors lib/share-cards/modules/index.ts's registerGmCardModules().
 */
function register<T>(m: VizModule<T>): void {
  if (!getVizModule(m.type)) registerVizModule(m);
}

export function registerStoryModules(): void {
  register(storyChartModule);
  register(storyHeroModule);
  register(storyImageModule);
  register(storyPullquoteModule);
  register(storyCtaModule);
  register(storyCalloutModule);
}
