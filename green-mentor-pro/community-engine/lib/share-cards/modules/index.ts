import { getVizModule, registerVizModule, type VizModule } from "@vismay/viz-engine";
import articleModule from "./article";
import headlineModule from "./headline";
import imageModule from "./image";
import chipsModule from "./chips";
import logoModule from "./logo";
import badgeModule from "./badge";

/**
 * Register the GreenMentor share-card module family (`gmcard:*`) into the
 * viz-engine registry. Distinct prefix so they can coexist with any other
 * module family the workspace loads. Idempotent (guards on `getVizModule`) —
 * the registry throws on double-register and this runs on every studio mount /
 * HMR reload. Mirrors footshorts' registerFootshortsShareCardModules.
 */
function register<T>(m: VizModule<T>): void {
  if (!getVizModule(m.type)) registerVizModule(m);
}

export function registerGmCardModules(): void {
  register(articleModule);
  register(headlineModule);
  register(imageModule);
  register(chipsModule);
  register(logoModule);
  register(badgeModule);
}
