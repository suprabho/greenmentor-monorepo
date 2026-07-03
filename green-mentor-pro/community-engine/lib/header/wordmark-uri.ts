import type { Brand } from "./brands";

/**
 * A brand's wordmark as an origin-free data URI in the requested color + style.
 * The art ships as a hollow outline (every shape `fill="none"`, one native
 * stroke color), so:
 *   • outline -> swap the stroke color, shapes stay hollow;
 *   • fill    -> paint every shape with the color and drop the stroke.
 * We URL-encode (not base64) to stay isomorphic — no Buffer/btoa needed.
 * Shared by the header renderer and the share-card logo module / stage chrome.
 */
export function wordmarkDataUri(brand: Brand, color: string, fill: boolean): string {
  let svg = brand.wordmarkSvg;
  if (fill) {
    svg = svg
      .split('fill="none"')
      .join(`fill="${color}"`)
      .split(`stroke="${brand.nativeColor}"`)
      .join('stroke="none"');
  } else if (color !== brand.nativeColor) {
    svg = svg.split(brand.nativeColor).join(color);
  }
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
