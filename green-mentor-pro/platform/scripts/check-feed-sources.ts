/**
 * Health check for every entry in RSS_SOURCES.
 *
 *   pnpm --filter @gm/platform feed:check
 *
 * Feeds fail silently: greenbiz.com/rss.xml kept returning HTTP 200 long after
 * the GreenBiz → Trellis rebrand, serving an HTML homepage that parses to zero
 * items, so the nightly worker logged "0 new" every night and nobody noticed.
 * This fetches each source, reports item count and thumbnail coverage, and
 * exits non-zero if anything looks dead — cheap enough to run in CI.
 *
 * Touches no database and needs no credentials.
 */
import { RSS_SOURCES, looksEsgRelevant } from "../lib/feed-sources";
import { FEED_USER_AGENT } from "../lib/feed/images";
import { parseFeed } from "../lib/feed/rss";

type Row = {
  id: string;
  region: string;
  status: string;
  items: number;
  relevant: number;
  withImage: number;
  dated: number;
  note: string;
};

async function check(source: (typeof RSS_SOURCES)[number]): Promise<Row> {
  const base = { id: source.id, region: source.region, items: 0, relevant: 0, withImage: 0, dated: 0 };

  let xml: string;
  try {
    const res = await fetch(source.feedUrl, {
      headers: { "user-agent": FEED_USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { ...base, status: `HTTP ${res.status}`, note: "unreachable" };
    xml = await res.text();
  } catch (e) {
    return { ...base, status: "ERR", note: e instanceof Error ? e.message : String(e) };
  }

  const items = parseFeed(xml);
  const relevant = source.strict
    ? items.filter((i) => looksEsgRelevant(`${i.title} ${i.description ?? ""}`)).length
    : items.length;

  const note =
    items.length === 0
      ? /<html/i.test(xml.slice(0, 400))
        ? "DEAD — serving HTML, not a feed"
        : "DEAD — no items parsed"
      : relevant === 0
        ? "no items passed the keyword gate"
        : "";

  return {
    ...base,
    status: "200",
    items: items.length,
    relevant,
    withImage: items.filter((i) => i.image).length,
    dated: items.filter((i) => i.publishedAt).length,
    note,
  };
}

async function main() {
  const rows = await Promise.all(RSS_SOURCES.map(check));

  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  console.log(
    `\n${pad("SOURCE", 20)}${pad("REGION", 8)}${pad("HTTP", 6)}${pad("ITEMS", 7)}${pad("ESG", 6)}${pad("IMG", 6)}${pad("DATED", 7)}NOTE`,
  );
  console.log("-".repeat(80));
  for (const r of rows) {
    console.log(
      `${pad(r.id, 20)}${pad(r.region, 8)}${pad(r.status, 6)}${pad(r.items, 7)}${pad(r.relevant, 6)}${pad(r.withImage, 6)}${pad(r.dated, 7)}${r.note}`,
    );
  }

  // Items without an in-feed image aren't a failure — the worker fetches the
  // page's og:image for those — but the ratio is worth watching.
  const totals = rows.reduce(
    (a, r) => ({ items: a.items + r.items, withImage: a.withImage + r.withImage }),
    { items: 0, withImage: 0 },
  );
  console.log(
    `\n${rows.length} sources · ${totals.items} items · ${totals.withImage} with an in-feed image ` +
      `(the rest fall back to og:image at ingest)`,
  );

  const broken = rows.filter((r) => r.items === 0);
  if (broken.length) {
    console.error(`\n✗ ${broken.length} source(s) returned no items: ${broken.map((r) => r.id).join(", ")}`);
    process.exit(1);
  }
  console.log("✓ every source is live");
}

main().catch((e) => {
  console.error("feed check failed:", e?.message ?? e);
  process.exit(1);
});
