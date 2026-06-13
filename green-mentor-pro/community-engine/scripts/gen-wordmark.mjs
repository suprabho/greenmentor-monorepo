#!/usr/bin/env node
/**
 * gen-wordmark.mjs — regenerate lib/header/wordmark.ts from the source SVG.
 *
 * The wordmark markup is inlined as a string so the renderer can recolor it
 * (swap the stroke color) and emit an origin-free data URI at render time —
 * the brand mark must render even on the headless skill CLI, which has no
 * asset origin. Run this whenever public/brand/wordmark-outline.svg changes:
 *
 *   node scripts/gen-wordmark.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(here, "../public/brand/wordmark-outline.svg");
const outPath = resolve(here, "../lib/header/wordmark.ts");

const svg = readFileSync(svgPath, "utf8").trim();

const out = `// AUTO-GENERATED — do not edit by hand.
//
// The GreenMentor wordmark markup, inlined so the renderer can recolor it and
// emit an origin-free data URI at render time (see wordmarkDataUri in
// render.ts). The brand mark must render identically across all three surfaces
// — editor preview, server export, headless skill CLI — WITHOUT depending on
// an asset origin. The canonical source SVG lives at
// public/brand/wordmark-outline.svg; regenerate with: node scripts/gen-wordmark.mjs
//
// Source: academy/green-mentor-plus/public/brand/wordmark-outline.svg

export const WORDMARK_SVG = ${JSON.stringify(svg)};
`;

writeFileSync(outPath, out);
console.log(`✓ Wrote ${outPath} (svg ${(svg.length / 1024).toFixed(0)} KB)`);
