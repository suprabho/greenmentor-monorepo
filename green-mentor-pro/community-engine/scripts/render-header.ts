#!/usr/bin/env -S npx tsx
/**
 * render-header.ts — standalone aura-header renderer for the `aura-header` skill.
 *
 * NO dev server required: it renders lib/header's canonical HTML directly with
 * Playwright and writes a PNG. Same pixels as the in-app "Download PNG" button.
 *
 * Usage:
 *   npx tsx scripts/render-header.ts --config path/to/config.json --out header.png
 *   cat config.json | npx tsx scripts/render-header.ts --out header.png        # stdin
 *
 * Options:
 *   --config <file>   HeaderConfig JSON (omit to read JSON from stdin)
 *   --out <file>      output PNG path            (default: ./header.png)
 *   --scale <n>       pixel density              (default: 2)
 *   --origin <url>    resolve app-relative photo paths (e.g. http://localhost:3100)
 *   --settle <ms>     aura warm-up before shot   (default: 2600)
 *
 * Speaker photos: pass an absolute https URL, OR a /avatars/… path together
 * with --origin pointing at a running app, OR a file:// URL.
 */

import { readFileSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { renderHeaderPng } from "../lib/header/screenshot";
import { DEFAULT_CONFIG, type HeaderConfig } from "../lib/header/types";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

async function main() {
  const configPath = arg("config");
  const out = arg("out") ?? "header.png";
  const scale = Number(arg("scale") ?? 2);
  const origin = arg("origin");
  const settleMs = Number(arg("settle") ?? 2600);

  const raw = configPath ? readFileSync(configPath, "utf8") : readStdin();
  if (!raw.trim()) {
    console.error("No config provided. Use --config <file> or pipe JSON via stdin.");
    process.exit(1);
  }

  const parsed = JSON.parse(raw) as Partial<HeaderConfig>;
  const config: HeaderConfig = { ...DEFAULT_CONFIG, ...parsed };
  if (!config.title?.trim()) {
    console.error("config.title is required.");
    process.exit(1);
  }

  console.error(`Rendering "${config.title.slice(0, 60)}…" (${config.sizeId})…`);
  const png = await renderHeaderPng(config, { origin, scale, settleMs });
  writeFileSync(out, png);
  console.error(`✓ Wrote ${out} (${(png.length / 1024).toFixed(0)} KB)`);
  console.log(out);
}

main().catch((e) => {
  console.error(`render-header failed: ${e?.message ?? e}`);
  if (/Executable doesn't exist|launch/i.test(String(e?.message))) {
    console.error("→ Install the browser: npx playwright install chromium");
  }
  process.exit(1);
});
