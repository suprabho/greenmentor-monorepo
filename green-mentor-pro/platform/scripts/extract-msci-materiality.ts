/**
 * MSCI ESG Industry Materiality Map — one-time authenticated weight extractor.
 *
 *   node --import tsx scripts/extract-msci-materiality.ts --login     # step 1 (headed)
 *   node --import tsx scripts/extract-msci-materiality.ts             # step 2 (extract)
 *
 * ─── PROPRIETARY / INTERNAL USE ONLY ──────────────────────────────────────────
 * The per-industry Key Issue WEIGHT matrix on MSCI's Materiality Map is gated
 * behind a (free) MSCI account login — the public page shows only the taxonomy
 * (see lib/msci/materiality-map.ts). This tool captures that gated matrix ONCE,
 * for internal reference only. It never handles your password: YOU log in by
 * hand in a real browser window (`--login`), we persist only the resulting
 * session cookies to a gitignored file, then reuse them to read the map's
 * backing Flourish JSON (`--extract`, the default). Do not run on a schedule and
 * do not redistribute the output.
 *
 * The map is a Flourish visualisation (@flourish/…); its config — { metadata,
 * data, bindings, template } — is fetched client-side once the widget mounts.
 * We intercept that response and dump it raw to --out for human validation, then
 * a human transcribes the weights into lib/msci/materiality-map.ts alongside the
 * committed taxonomy (reconciling Key Issue names against MSCI_KEY_ISSUES).
 *
 * PREREQUISITE: `playwright` must be installed for @gm/platform. It is declared
 * in package.json but may not be linked yet — run `pnpm install` at the repo
 * root first. The chromium browser download is a one-off (`pnpm exec playwright
 * install chromium` if the launch complains a browser is missing).
 *
 * Flags:
 *   --login        open a headed browser, let you sign in, save the session, exit
 *   --headed       run the extract pass with a visible browser (default: headless)
 *   --auth=PATH    session storageState file (default: scripts/.out/msci-auth.json)
 *   --out=PATH     raw capture output (default: scripts/.out/msci-raw.json)
 *   --url=URL      override the map URL
 */
import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium, type BrowserContext } from "playwright";

const MAP_URL =
  "https://www.msci.com/data-and-analytics/sustainability-solutions/esg-industry-materiality-map";
const DEFAULT_AUTH = "scripts/.out/msci-auth.json";
const DEFAULT_OUT = "scripts/.out/msci-raw.json";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

type Options = {
  login: boolean;
  headed: boolean;
  auth: string;
  out: string;
  url: string;
};

function parseOptions(): Options {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift(); // `pnpm run … -- --flag`
  const { values } = parseArgs({
    args,
    options: {
      login: { type: "boolean", default: false },
      headed: { type: "boolean", default: false },
      auth: { type: "string", default: DEFAULT_AUTH },
      out: { type: "string", default: DEFAULT_OUT },
      url: { type: "string", default: MAP_URL },
    },
  });
  return {
    login: values.login,
    headed: values.headed,
    auth: values.auth!,
    out: values.out!,
    url: values.url!,
  };
}

async function ensureDir(file: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
}

/** Best-effort click-through of the OneTrust cookie banner (it auto-blocks the Flourish script). */
async function acceptCookies(context: BrowserContext): Promise<void> {
  const page = context.pages()[0];
  if (!page) return;
  for (const sel of ["#onetrust-accept-btn-handler", 'button:has-text("Accept")']) {
    try {
      const el = page.locator(sel).first();
      if (await el.count()) {
        await el.click({ timeout: 4000 });
        return;
      }
    } catch {
      /* banner not present — fine */
    }
  }
}

// ── --login: capture an authenticated session ────────────────────────────────

async function login(opts: Options): Promise<void> {
  console.log("[login] opening a browser window — sign in to your MSCI account and");
  console.log("[login] navigate until you can SEE the materiality map render, then");
  console.log("[login] come back here and press Enter.\n");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  await page.goto(opts.url, { waitUntil: "domcontentloaded" });
  await acceptCookies(context);

  const rl = createInterface({ input: stdin, output: stdout });
  await rl.question("Press Enter once the map is visible… ");
  rl.close();

  await ensureDir(opts.auth);
  await context.storageState({ path: opts.auth });
  console.log(`[login] session saved → ${opts.auth}`);
  await browser.close();
}

// ── default: reuse the session and read the portlet's inline data globals ─────
//
// The map is a Liferay portlet loaded in an iframe from www-cdn.msci.com. Its
// map.js does NOT fetch data — the whole matrix is inlined into the (gated)
// portlet HTML as four JS globals, which map.js reads:
//   themes         — [{ name, classification, issues:[{ name, description }] }]  (taxonomy)
//   sectorData     — { <2-digit GICS>: { name, data:number[] } }                 (sector weights)
//   subsectorData  — { <8-digit GICS>: { name, data:number[] } }                 (sub-industry weights)
//   relevance      — { <GICS>: { name, data:(0|1)[] } }                          (is-a-Key-Issue flags)
// Each `data[]` is 28 long, indexed by the flat issue counter across `themes`
// (indices 0–26 = the 27 Environmental+Social Key Issues, index 27 = the single
// combined Governance weight; the 6 Governance sub-issues are unweighted detail).

const PORTLET_RE = /materiality_map_portlet/;

type RawGlobals = {
  themes: unknown;
  sectorData: unknown;
  subsectorData: unknown;
  relevance: unknown;
};

async function extract(opts: Options): Promise<void> {
  const storageState = opts.auth;
  try {
    await readFile(opts.auth, "utf8");
  } catch {
    console.error(
      `[extract] no session at ${opts.auth} — run with --login first (you must be signed in to MSCI).`,
    );
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: !opts.headed });
  const context = await browser.newContext({ userAgent: USER_AGENT, storageState });
  const page = await context.newPage();

  console.log(`[extract] loading ${opts.url}`);
  await page.goto(opts.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await acceptCookies(context);
  // Scroll the lazy portlet iframe into view and let it render.
  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(4_000);

  const frame = page.frames().find((f) => PORTLET_RE.test(f.url()));
  if (!frame) {
    await browser.close();
    console.error(
      "[extract] materiality-map portlet iframe not found — the map didn't render.\n" +
        "  Likely the session isn't authenticated (re-run --login and make sure you can\n" +
        "  SEE the map), or MSCI changed the embed. Try --headed to watch.",
    );
    process.exit(1);
  }

  // Read the four globals straight out of the iframe's JS context.
  const data = await frame.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    return {
      themes: w.themes ?? null,
      sectorData: w.sectorData ?? null,
      subsectorData: w.subsectorData ?? null,
      relevance: w.relevance ?? null,
    } as RawGlobals;
  });
  await browser.close();

  const missing = (Object.keys(data) as (keyof RawGlobals)[]).filter((k) => !data[k]);
  if (missing.length) {
    console.error(
      `[extract] portlet loaded but these data globals were absent: ${missing.join(", ")}.\n` +
        "  MSCI may have changed the portlet — inspect the iframe source. Try --headed.",
    );
    process.exit(1);
  }

  const themeCount = Array.isArray(data.themes) ? data.themes.length : 0;
  const sectors = data.sectorData ? Object.keys(data.sectorData as object).length : 0;
  const subs = data.subsectorData ? Object.keys(data.subsectorData as object).length : 0;

  await ensureDir(opts.out);
  await writeFile(
    opts.out,
    JSON.stringify(
      { source: opts.url, capturedFromFrame: frame.url(), ...data },
      null,
      2,
    ),
  );
  console.log(
    `\n✓ captured → ${opts.out}\n` +
      `  ${themeCount} theme groups · ${sectors} sectors · ${subs} sub-industries.\n` +
      "  Validate it, then (re)generate lib/msci/ from it — reconcile Key Issue names\n" +
      "  against MSCI_KEY_ISSUES and the 28-column weight order.",
  );
}

async function main() {
  const opts = parseOptions();
  if (opts.login) await login(opts);
  else await extract(opts);
}

main().catch((e) => {
  console.error("msci extract failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
