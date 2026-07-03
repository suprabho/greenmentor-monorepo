"use client";

import {
  DEFAULT_TRANSFORM,
  LayerView,
  layerBoxStyle,
  transformWrapperStyle,
  type ComposerLayer,
} from "@vismay/viz-admin";
import { registerGmCardModules } from "./modules";

// LayerView resolves module types from the viz-engine registry in whichever
// bundle this component runs (SSR + browser) — register here, at client-module
// scope, so the render page works without the studio ever having loaded.
registerGmCardModules();

/**
 * The render-route twin of PreviewPane's free-mode body: the same wrapper DOM,
 * built with the same imported transform/box helpers, minus the drag handles —
 * so the export's geometry cannot drift from the editor preview. Keep in
 * lockstep with PreviewPane.tsx's `arrangement === 'free'` branch.
 */
export function StaticCardLayers({ layers }: { layers: ComposerLayer[] }) {
  return (
    <>
      {layers
        .filter((l) => l.visible)
        .map((l) => (
          <div
            key={l.id}
            style={transformWrapperStyle(l.transform ?? DEFAULT_TRANSFORM, { sizeByWidth: true })}
          >
            <div className="relative h-full w-full overflow-hidden" style={layerBoxStyle(l.box)}>
              <LayerView layer={l.layer} />
            </div>
          </div>
        ))}
    </>
  );
}
