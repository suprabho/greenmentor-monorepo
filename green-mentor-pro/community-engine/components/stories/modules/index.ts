import { getVizModule, registerVizModule, type VizModule } from "@vismay/viz-engine";
import storyChartModule from "./chart";

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
}
