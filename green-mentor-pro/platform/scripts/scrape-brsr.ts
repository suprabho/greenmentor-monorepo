/**
 * NSE BRSR filings scraper — index sync, XBRL archive, indicator extraction.
 *
 *   node --env-file=.env.local --import tsx scripts/scrape-brsr.ts [flags]
 *
 * Three idempotent, resumable stages (state lives in brsr_filings status
 * columns, so a killed run picks up where it left off):
 *   index       fetch NSE's BRSR filing index → upsert brsr_filings metadata
 *   files       download pending XBRL files → private brsr-filings bucket
 *   indicators  parse stored XBRL (lib/brsr/xbrl.ts + tag-map.ts) → brsr_indicators
 *
 * Flags:
 *   index       fetch NSE's BRSR filing index → upsert brsr_filings metadata
 *   topics      extract Section A material topics from stored XBRL → brsr_material_topics
 *   canon       map new topic phrasings to canonical topics via Claude → brsr_topic_canon
 *
 *   --stage=index|files|indicators|topics|canon|all   default all
 *   --from=DD-MM-YYYY --to=DD-MM-YYYY    index backfill window (NSE param format);
 *                                        omitted → NSE's default rolling ~1-year window
 *   --limit=N                            cap files downloaded / filings parsed this run
 *   --symbol=RELIANCE                    restrict files/indicators stages to one company
 *   --dry-run                            log decisions, write nothing
 *   --reparse                            indicators stage: re-extract already-parsed filings
 *   --retopics                           topics stage: re-extract already-extracted filings
 *   --dump-tags                          dev: print a numeric-tag histogram from stored XBRLs
 *
 * Writes use the service-role client, so NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY must be set. Indicator and topic extraction are
 * deterministic; only the `canon` stage calls Claude (Haiku), and it degrades
 * to a logged skip when ANTHROPIC_API_KEY is absent. Politeness (1 req/s,
 * sequential, Akamai-aware retries) is enforced inside lib/brsr/nse-client.ts.
 */
import { parseArgs } from "node:util";
import { createAdminClient } from "../lib/supabase/admin";
import { fetchFile, fetchIndex, NotFoundError, type NseFilingRaw } from "../lib/brsr/nse-client";
import { getClient } from "@gm/agents";
import {
  extractContexts,
  extractFacts,
  extractMaterialTopics,
  matchIndicators,
  normalizeTopic,
  tagHistogram,
} from "../lib/brsr/xbrl";
import { BRSR_TAG_MAP } from "../lib/brsr/tag-map";
import {
  buildCanonSystemPrompt,
  MAP_TOPICS_TOOL,
  SEED_VOCAB,
  validateMappings,
  vocabKey,
  type VocabEntry,
} from "../lib/brsr/topic-canon";

const BUCKET = "brsr-filings";
const MAX_DOWNLOAD_ATTEMPTS = Number(process.env.BRSR_MAX_ATTEMPTS ?? 4);
const BREAKER_LIMIT = Number(process.env.BRSR_BREAKER_LIMIT ?? 5);

type Supabase = ReturnType<typeof createAdminClient>;

type CliOptions = {
  stage: "index" | "files" | "indicators" | "topics" | "canon" | "all";
  from?: string;
  to?: string;
  limit: number;
  symbol?: string;
  dryRun: boolean;
  reparse: boolean;
  retopics: boolean;
  dumpTags: boolean;
};

function parseCliOptions(): CliOptions {
  // `pnpm run script -- --flag` forwards the `--` separator verbatim, and
  // parseArgs would then read every flag after it as a positional. Drop it.
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  const { values } = parseArgs({
    args,
    options: {
      stage: { type: "string", default: "all" },
      from: { type: "string" },
      to: { type: "string" },
      limit: { type: "string" },
      symbol: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      reparse: { type: "boolean", default: false },
      retopics: { type: "boolean", default: false },
      "dump-tags": { type: "boolean", default: false },
    },
  });
  const stage = values.stage as CliOptions["stage"];
  if (!["index", "files", "indicators", "topics", "canon", "all"].includes(stage)) {
    throw new Error(`--stage must be index|files|indicators|topics|canon|all, got "${stage}"`);
  }
  for (const [flag, v] of [["from", values.from], ["to", values.to]] as const) {
    if (v && !/^\d{2}-\d{2}-\d{4}$/.test(v)) {
      throw new Error(`--${flag} must be DD-MM-YYYY (NSE's format), got "${v}"`);
    }
  }
  const limit = values.limit ? Number(values.limit) : Infinity;
  if (Number.isNaN(limit) || limit <= 0) throw new Error(`--limit must be a positive number`);
  return {
    stage,
    from: values.from,
    to: values.to,
    limit,
    symbol: values.symbol,
    dryRun: values["dry-run"],
    reparse: values.reparse,
    retopics: values.retopics,
    dumpTags: values["dump-tags"],
  };
}

// ---------------------------------------------------------------------------
// normalization

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** "10-Jul-2026" or "10-07-2026" → "2026-07-10"; "-" / unparseable → null. */
function parseNseDate(s: string | undefined): string | null {
  const t = s?.trim();
  if (!t || t === "-") return null;
  const named = t.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (named) {
    const month = MONTHS[named[2].toLowerCase()];
    return month ? `${named[3]}-${month}-${named[1].padStart(2, "0")}` : null;
  }
  const numeric = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (numeric) return `${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
  return null;
}

/** "1.12 MB" / "700.99 KB" → bytes; "-" / unparseable → null. */
function parseSizeBytes(s: string | undefined): number | null {
  const m = s?.trim().match(/^([\d.]+)\s*(KB|MB|GB)$/i);
  if (!m) return null;
  const factor = { kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[m[2].toLowerCase() as "kb" | "mb" | "gb"];
  return Math.round(Number(m[1]) * factor);
}

const urlOrNull = (s: string | undefined): string | null => {
  const t = s?.trim();
  return t && t !== "-" && /^https?:\/\//.test(t) ? t : null;
};

type FilingUpsert = {
  symbol: string;
  company_name: string;
  fy_from: number;
  fy_to: number;
  submission_date: string | null;
  revision_date: string | null;
  pdf_url: string | null;
  pdf_size_bytes: number | null;
  xbrl_url: string | null;
  xbrl_size_bytes: number | null;
  raw: NseFilingRaw;
};

function normalize(item: NseFilingRaw): FilingUpsert | null {
  const symbol = item.symbol?.trim();
  const companyName = item.companyName?.trim();
  const fyFrom = Number(item.fyFrom);
  const fyTo = Number(item.fyTo);
  if (!symbol || !companyName || !Number.isInteger(fyFrom) || !Number.isInteger(fyTo)) return null;
  return {
    symbol,
    company_name: companyName,
    fy_from: fyFrom,
    fy_to: fyTo,
    submission_date: parseNseDate(item.submissionDate),
    revision_date: parseNseDate(item.revisionDate),
    pdf_url: urlOrNull(item.attachmentFile),
    pdf_size_bytes: parseSizeBytes(item.attFileSize),
    xbrl_url: urlOrNull(item.xbrlFile),
    xbrl_size_bytes: parseSizeBytes(item.xbrlFileSize),
    raw: item,
  };
}

/** "2025-26" — the FY folder in the bucket and the label in logs. */
const fyLabel = (fyFrom: number, fyTo: number) => `${fyFrom}-${String(fyTo).padStart(4, "0").slice(-2)}`;

const safePathPart = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, "_");

const chunk = <T,>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));

// ---------------------------------------------------------------------------
// stage 1 — index sync

type ExistingRow = {
  id: string;
  symbol: string;
  fy_from: number;
  fy_to: number;
  revision_date: string | null;
  xbrl_url: string | null;
};

/** Page through all filings (the table stays small — a few thousand rows). */
async function loadExisting(supabase: Supabase): Promise<Map<string, ExistingRow>> {
  const map = new Map<string, ExistingRow>();
  const pageSize = 1000;
  for (let fromRow = 0; ; fromRow += pageSize) {
    const { data, error } = await supabase
      .from("brsr_filings")
      .select("id, symbol, fy_from, fy_to, revision_date, xbrl_url")
      .range(fromRow, fromRow + pageSize - 1);
    if (error) throw new Error(`could not read brsr_filings (${error.message}) — has migration 0011 been applied?`);
    for (const row of data ?? []) map.set(`${row.symbol}|${row.fy_from}|${row.fy_to}`, row);
    if (!data || data.length < pageSize) return map;
  }
}

async function syncIndex(supabase: Supabase, opts: CliOptions): Promise<string> {
  const windowLabel = opts.from || opts.to ? `${opts.from ?? "…"} → ${opts.to ?? "…"}` : "default (~1y)";
  console.log(`[index] fetching NSE BRSR index, window: ${windowLabel}`);
  const items = await fetchIndex(opts.from, opts.to);
  console.log(`[index] ${items.length} filings in index`);

  const existing = await loadExisting(supabase);
  const inserts = new Map<string, FilingUpsert>(); // dedup within one index response
  let revised = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const item of items) {
    const row = normalize(item);
    if (!row) {
      skipped++;
      console.warn(`[index] ! skipping malformed item: ${JSON.stringify(item).slice(0, 120)}`);
      continue;
    }
    const key = `${row.symbol}|${row.fy_from}|${row.fy_to}`;
    const prior = existing.get(key);
    if (!prior) {
      // Same company-FY twice in one response → keep the later submission.
      const dupe = inserts.get(key);
      if (!dupe || (row.submission_date ?? "") >= (dupe.submission_date ?? "")) inserts.set(key, row);
      continue;
    }
    const changed = prior.revision_date !== row.revision_date || prior.xbrl_url !== row.xbrl_url;
    if (!changed) {
      unchanged++;
      continue;
    }
    revised++;
    console.log(`[index] ~ revised: ${row.symbol} ${fyLabel(row.fy_from, row.fy_to)} — resetting stages`);
    if (!opts.dryRun) {
      const { error } = await supabase
        .from("brsr_filings")
        .update({
          ...row,
          xbrl_status: "pending",
          xbrl_attempts: 0,
          xbrl_error: null,
          parse_status: "pending",
          parse_error: null,
          // Topics come from the same XBRL — a revision staled them too.
          topics_status: "pending",
          topics_error: null,
        })
        .eq("id", prior.id);
      if (error) throw new Error(`revision update failed for ${row.symbol}: ${error.message}`);
    }
  }

  const newRows = [...inserts.values()];
  if (opts.dryRun) {
    for (const row of newRows.slice(0, 10)) {
      console.log(`[index]   would insert ${row.symbol} ${fyLabel(row.fy_from, row.fy_to)} (${row.submission_date})`);
    }
    if (newRows.length > 10) console.log(`[index]   … and ${newRows.length - 10} more`);
  } else {
    for (const batch of chunk(newRows, 500)) {
      const { error } = await supabase.from("brsr_filings").insert(batch);
      if (error) throw new Error(`insert failed: ${error.message}`);
    }
  }

  const summary = `index: ${newRows.length} new, ${revised} revised, ${unchanged} unchanged${skipped ? `, ${skipped} malformed` : ""}`;
  console.log(`[index] done — ${summary}${opts.dryRun ? " (dry-run, nothing written)" : ""}`);
  return summary;
}

// ---------------------------------------------------------------------------
// stage 2 — XBRL archive

type DownloadRow = {
  id: string;
  symbol: string;
  fy_from: number;
  fy_to: number;
  xbrl_url: string;
  xbrl_attempts: number;
};

async function ensureBucket(supabase: Supabase): Promise<void> {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
  // "already exists" (409 / Duplicate) is the happy path on re-runs.
  if (error && !/exists|duplicate/i.test(error.message)) {
    throw new Error(`could not ensure bucket ${BUCKET}: ${error.message}`);
  }
}

async function archiveFiles(supabase: Supabase, opts: CliOptions): Promise<string> {
  if (!opts.dryRun) await ensureBucket(supabase);

  let query = supabase
    .from("brsr_filings")
    .select("id, symbol, fy_from, fy_to, xbrl_url, xbrl_attempts")
    .not("xbrl_url", "is", null)
    .or(`xbrl_status.eq.pending,and(xbrl_status.eq.failed,xbrl_attempts.lt.${MAX_DOWNLOAD_ATTEMPTS})`)
    .order("submission_date", { ascending: false, nullsFirst: false });
  if (opts.symbol) query = query.eq("symbol", opts.symbol);
  if (Number.isFinite(opts.limit)) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw new Error(`could not read download queue: ${error.message}`);
  const queue = (data ?? []) as DownloadRow[];
  console.log(`[files] ${queue.length} XBRL file(s) queued${opts.symbol ? ` for ${opts.symbol}` : ""}`);

  if (opts.dryRun) {
    for (const row of queue.slice(0, 10)) console.log(`[files]   would download ${row.symbol} ${fyLabel(row.fy_from, row.fy_to)}`);
    if (queue.length > 10) console.log(`[files]   … and ${queue.length - 10} more`);
    return `files: ${queue.length} queued (dry-run)`;
  }

  let stored = 0;
  let failed = 0;
  let skipped = 0;
  let consecutiveFailures = 0;
  for (const row of queue) {
    const label = `${row.symbol} ${fyLabel(row.fy_from, row.fy_to)}`;
    // NSE's index emits ".../xbrl/null" for some legacy filings — nothing to fetch.
    if (row.xbrl_url.endsWith("/null")) {
      skipped++;
      console.log(`[files] ∅ ${label}: index has no real XBRL URL — skipped`);
      await supabase
        .from("brsr_filings")
        .update({ xbrl_status: "skipped", xbrl_error: "index provided null xbrl url" })
        .eq("id", row.id);
      continue;
    }
    try {
      const bytes = await fetchFile(row.xbrl_url);
      const path = `xbrl/${fyLabel(row.fy_from, row.fy_to)}/${safePathPart(row.symbol)}.xml`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: "application/xml", upsert: true });
      if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);

      const { error: updErr } = await supabase
        .from("brsr_filings")
        .update({
          xbrl_status: "stored",
          xbrl_storage_path: path,
          xbrl_downloaded_at: new Date().toISOString(),
          xbrl_attempts: row.xbrl_attempts + 1,
          xbrl_error: null,
        })
        .eq("id", row.id);
      if (updErr) throw new Error(`row update failed: ${updErr.message}`);

      stored++;
      consecutiveFailures = 0;
      console.log(`[files] ✓ ${label} (${(bytes.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (e instanceof NotFoundError) {
        // Permanently gone at NSE (common for pre-FY23-24 filings): park as
        // skipped so it neither retries nor trips the blocked-breaker.
        skipped++;
        console.log(`[files] ∅ ${label}: ${message} — file gone at NSE, skipped`);
        await supabase
          .from("brsr_filings")
          .update({ xbrl_status: "skipped", xbrl_error: message.slice(0, 500) })
          .eq("id", row.id);
        continue;
      }
      failed++;
      consecutiveFailures++;
      console.error(`[files] ✗ ${label}: ${message}`);
      await supabase
        .from("brsr_filings")
        .update({ xbrl_status: "failed", xbrl_attempts: row.xbrl_attempts + 1, xbrl_error: message.slice(0, 500) })
        .eq("id", row.id);
      if (consecutiveFailures >= BREAKER_LIMIT) {
        console.error(`[files] ✗ ${BREAKER_LIMIT} consecutive failures — likely blocked, stopping stage. Remaining files stay queued.`);
        process.exitCode = 1;
        break;
      }
    }
  }
  const summary = `files: ${stored} stored, ${skipped} skipped (gone at NSE), ${failed} failed`;
  console.log(`[files] done — ${summary}`);
  return summary;
}

// ---------------------------------------------------------------------------
// stage 3 — indicator extraction

type ParseRow = {
  id: string;
  symbol: string;
  fy_from: number;
  fy_to: number;
  xbrl_storage_path: string;
};

async function extractIndicators(supabase: Supabase, opts: CliOptions): Promise<string> {
  let query = supabase
    .from("brsr_filings")
    .select("id, symbol, fy_from, fy_to, xbrl_storage_path")
    .eq("xbrl_status", "stored")
    .order("submission_date", { ascending: false, nullsFirst: false });
  if (!opts.reparse) query = query.eq("parse_status", "pending");
  if (opts.symbol) query = query.eq("symbol", opts.symbol);
  if (Number.isFinite(opts.limit)) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw new Error(`could not read parse queue: ${error.message}`);
  const queue = (data ?? []) as ParseRow[];
  console.log(`[indicators] ${queue.length} filing(s) queued${opts.reparse ? " (reparse)" : ""}`);

  let parsed = 0;
  let failed = 0;
  let rows = 0;
  for (const filing of queue) {
    const label = `${filing.symbol} ${fyLabel(filing.fy_from, filing.fy_to)}`;
    try {
      const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(filing.xbrl_storage_path);
      if (dlErr || !blob) throw new Error(`storage download failed: ${dlErr?.message ?? "no data"}`);
      const xml = await blob.text();

      const { indicators, coverage } = matchIndicators(extractFacts(xml), extractContexts(xml));
      console.log(
        `[indicators] ${opts.dryRun ? "would parse" : "✓"} ${label}: ${coverage.matchedKeys.length}/${BRSR_TAG_MAP.length} keys · ${indicators.length} rows · ${coverage.contexts} contexts`,
      );
      if (opts.dryRun) continue;

      const { error: delErr } = await supabase.from("brsr_indicators").delete().eq("filing_id", filing.id);
      if (delErr) throw new Error(`indicator delete failed: ${delErr.message}`);
      for (const batch of chunk(indicators, 500)) {
        const { error: insErr } = await supabase.from("brsr_indicators").insert(
          batch.map((i) => ({
            filing_id: filing.id,
            indicator_key: i.key,
            raw_tag: i.rawTag,
            context_ref: i.contextRef,
            period_start: i.periodStart,
            period_end: i.periodEnd,
            unit: i.unit,
            value_numeric: i.value,
          })),
        );
        if (insErr) throw new Error(`indicator insert failed: ${insErr.message}`);
      }
      const { error: updErr } = await supabase
        .from("brsr_filings")
        .update({
          parse_status: "parsed",
          parsed_at: new Date().toISOString(),
          indicator_count: indicators.length,
          parse_error: null,
        })
        .eq("id", filing.id);
      if (updErr) throw new Error(`row update failed: ${updErr.message}`);
      parsed++;
      rows += indicators.length;
    } catch (e) {
      failed++;
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[indicators] ✗ ${label}: ${message}`);
      if (!opts.dryRun) {
        await supabase
          .from("brsr_filings")
          .update({ parse_status: "failed", parse_error: message.slice(0, 500) })
          .eq("id", filing.id);
      }
    }
  }
  const summary = `indicators: ${parsed} parsed (${rows} rows), ${failed} failed`;
  console.log(`[indicators] done — ${summary}${opts.dryRun ? " (dry-run, nothing written)" : ""}`);
  return summary;
}

// ---------------------------------------------------------------------------
// stage 4 — material-topics extraction (Section A, deterministic)

async function extractTopics(supabase: Supabase, opts: CliOptions): Promise<string> {
  let extracted = 0;
  let failed = 0;
  let topicRows = 0;
  let remaining = Number.isFinite(opts.limit) ? opts.limit : Infinity;

  // Outer drain-loop: PostgREST caps each select at 1000 rows, but processed
  // filings leave the queue (topics_status flips), so re-querying until empty
  // covers the whole backlog in one run. --retopics keeps rows in the queue,
  // so it deliberately runs a single pass (use with --symbol/--limit).
  while (remaining > 0) {
    let query = supabase
      .from("brsr_filings")
      .select("id, symbol, fy_from, fy_to, xbrl_storage_path")
      .eq("xbrl_status", "stored")
      .order("submission_date", { ascending: false, nullsFirst: false });
    if (!opts.retopics) query = query.eq("topics_status", "pending");
    if (opts.symbol) query = query.eq("symbol", opts.symbol);
    if (Number.isFinite(remaining)) query = query.limit(Math.min(remaining, 1000));

    const { data, error } = await query;
    if (error) throw new Error(`could not read topics queue (${error.message}) — has migration 0012 been applied?`);
    const queue = (data ?? []) as ParseRow[];
    if (queue.length === 0) break;
    console.log(`[topics] ${queue.length} filing(s) queued${opts.retopics ? " (retopics)" : ""}`);

    for (const filing of queue) {
      const label = `${filing.symbol} ${fyLabel(filing.fy_from, filing.fy_to)}`;
      try {
        const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(filing.xbrl_storage_path);
        if (dlErr || !blob) throw new Error(`storage download failed: ${dlErr?.message ?? "no data"}`);
        const topics = extractMaterialTopics(await blob.text());
        console.log(`[topics] ${opts.dryRun ? "would extract" : "✓"} ${label}: ${topics.length} topic(s)`);
        if (opts.dryRun) continue;

        const { error: delErr } = await supabase.from("brsr_material_topics").delete().eq("filing_id", filing.id);
        if (delErr) throw new Error(`topics delete failed: ${delErr.message}`);
        for (const batch of chunk(topics, 500)) {
          const { error: insErr } = await supabase.from("brsr_material_topics").insert(
            batch.map((t) => ({
              filing_id: filing.id,
              context_ref: t.contextRef,
              row_ord: t.rowOrd,
              topic_raw: t.topicRaw,
              topic_norm: normalizeTopic(t.topicRaw),
              risk_opportunity: t.riskOpportunity,
              rationale: t.rationale,
              approach: t.approach,
              financial_implications: t.financialImplications,
            })),
          );
          if (insErr) throw new Error(`topics insert failed: ${insErr.message}`);
        }
        const { error: updErr } = await supabase
          .from("brsr_filings")
          .update({
            topics_status: "extracted",
            topic_count: topics.length,
            topics_extracted_at: new Date().toISOString(),
            topics_error: null,
          })
          .eq("id", filing.id);
        if (updErr) throw new Error(`row update failed: ${updErr.message}`);
        extracted++;
        topicRows += topics.length;
      } catch (e) {
        failed++;
        const message = e instanceof Error ? e.message : String(e);
        console.error(`[topics] ✗ ${label}: ${message}`);
        if (!opts.dryRun) {
          await supabase
            .from("brsr_filings")
            .update({ topics_status: "failed", topics_error: message.slice(0, 500) })
            .eq("id", filing.id);
        }
      }
    }
    remaining -= queue.length;
    if (opts.dryRun || opts.retopics) break; // single pass — queue doesn't shrink
  }

  const summary = `topics: ${extracted} extracted (${topicRows} rows), ${failed} failed`;
  console.log(`[topics] done — ${summary}${opts.dryRun ? " (dry-run, nothing written)" : ""}`);
  return summary;
}

// ---------------------------------------------------------------------------
// stage 5 — canonicalization of new topic phrasings (Claude, cached)

const CANON_MODEL = process.env.BRSR_CANON_MODEL ?? "claude-haiku-4-5";
const CANON_BATCH = Number(process.env.BRSR_CANON_BATCH ?? 50);

/** Working vocabulary = seed list + every canonical the cache already holds. */
async function loadVocab(supabase: Supabase): Promise<VocabEntry[]> {
  const vocab = [...SEED_VOCAB];
  const keys = new Set(vocab.map((v) => vocabKey(v.topic)));
  const pageSize = 1000;
  for (let fromRow = 0; ; fromRow += pageSize) {
    const { data, error } = await supabase
      .from("brsr_topic_canon")
      .select("canonical_topic, pillar")
      .range(fromRow, fromRow + pageSize - 1);
    if (error) throw new Error(`could not read brsr_topic_canon (${error.message}) — has migration 0012 been applied?`);
    for (const row of data ?? []) {
      const key = vocabKey(row.canonical_topic);
      if (keys.has(key)) continue;
      keys.add(key);
      vocab.push({ topic: row.canonical_topic, pillar: row.pillar });
    }
    if (!data || data.length < pageSize) return vocab;
  }
}

async function canonTopics(supabase: Supabase, opts: CliOptions): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[canon] ANTHROPIC_API_KEY not set — skipping canonicalization");
    return "canon: skipped (no ANTHROPIC_API_KEY)";
  }
  const client = getClient();
  const vocab = await loadVocab(supabase);
  console.log(`[canon] vocabulary: ${vocab.length} canonical topics (${SEED_VOCAB.length} seeded)`);

  let mapped = 0;
  let calls = 0;
  let newCanonicals = 0;
  const limit = Number.isFinite(opts.limit) ? opts.limit : Infinity;

  while (mapped < limit) {
    const { data, error } = await supabase.rpc("brsr_unmapped_topic_norms", {
      batch_size: Math.min(CANON_BATCH, limit - mapped),
    });
    if (error) throw new Error(`unmapped-norms rpc failed (${error.message}) — has migration 0012 been applied?`);
    const norms = ((data ?? []) as { topic_norm: string; mentions: number }[]).map((r) => r.topic_norm);
    if (norms.length === 0) break;

    calls++;
    const msg = await client.messages.create({
      model: CANON_MODEL,
      max_tokens: 4000,
      system: buildCanonSystemPrompt(vocab),
      tools: [MAP_TOPICS_TOOL],
      tool_choice: { type: "tool", name: "map_topics" },
      messages: [{ role: "user", content: norms.map((n, i) => `${i}. ${n}`).join("\n") }],
    });
    const use = msg.content.find((b) => b.type === "tool_use");
    const { mappings, newEntries } = validateMappings(norms, use?.input, vocab);

    if (opts.dryRun) {
      for (const m of mappings) {
        console.log(`[canon]   ${m.topicNorm.slice(0, 60)} → ${m.canonicalTopic} (${m.pillar}, ${m.confidence})`);
      }
      console.log(`[canon] dry-run — ${mappings.length}/${norms.length} would be mapped; stopping after one batch`);
      return `canon: dry-run, ${mappings.length} proposed`;
    }
    if (mappings.length === 0) {
      // Writing nothing means the same batch would return forever — bail loudly.
      console.error(`[canon] ✗ batch of ${norms.length} produced no valid mappings — stopping`);
      process.exitCode = 1;
      break;
    }

    const { error: upErr } = await supabase.from("brsr_topic_canon").upsert(
      mappings.map((m) => ({
        topic_norm: m.topicNorm,
        canonical_topic: m.canonicalTopic,
        pillar: m.pillar,
        confidence: m.confidence,
        model: CANON_MODEL,
      })),
      { onConflict: "topic_norm", ignoreDuplicates: true },
    );
    if (upErr) throw new Error(`canon upsert failed: ${upErr.message}`);

    for (const entry of newEntries) {
      vocab.push(entry);
      newCanonicals++;
      console.log(`[canon]   new canonical: ${entry.topic} (${entry.pillar})`);
    }
    mapped += mappings.length;
    console.log(`[canon] ✓ batch ${calls}: ${mappings.length}/${norms.length} mapped (${mapped} total)`);
  }

  const summary = `canon: ${mapped} mapped in ${calls} call(s)${newCanonicals ? `, ${newCanonicals} new canonical(s)` : ""}`;
  console.log(`[canon] done — ${summary}`);
  return summary;
}

// ---------------------------------------------------------------------------
// --dump-tags — tag-map calibration helper

async function dumpTags(supabase: Supabase, opts: CliOptions): Promise<void> {
  let query = supabase
    .from("brsr_filings")
    .select("symbol, fy_from, fy_to, xbrl_storage_path")
    .eq("xbrl_status", "stored");
  if (opts.symbol) query = query.eq("symbol", opts.symbol);
  query = query.limit(Number.isFinite(opts.limit) ? opts.limit : 10);

  const { data, error } = await query;
  if (error) throw new Error(`could not list stored filings: ${error.message}`);
  const filings = (data ?? []) as ParseRow[];
  if (filings.length === 0) {
    console.log("no stored XBRL files yet — run --stage=files first");
    return;
  }

  const merged = new Map<string, { files: number; count: number; unit: string | null; sample: string }>();
  for (const filing of filings) {
    const { data: blob } = await supabase.storage.from(BUCKET).download(filing.xbrl_storage_path);
    if (!blob) continue;
    console.log(`# ${filing.symbol} ${fyLabel(filing.fy_from, filing.fy_to)}`);
    for (const [tag, info] of tagHistogram(await blob.text())) {
      const entry = merged.get(tag);
      if (entry) {
        entry.files++;
        entry.count += info.count;
      } else {
        merged.set(tag, { files: 1, count: info.count, unit: info.unit, sample: info.sample });
      }
    }
  }

  const mapped = new Set(BRSR_TAG_MAP.flatMap((d) => d.tags));
  const sorted = [...merged.entries()].sort((a, b) => b[1].files - a[1].files || b[1].count - a[1].count);
  console.log(`\ntag (★ = in tag-map) · files · facts · unit · sample — ${sorted.length} numeric tags across ${filings.length} file(s)\n`);
  for (const [tag, info] of sorted) {
    console.log(`${mapped.has(tag) ? "★" : " "} ${tag} · ${info.files} · ${info.count} · ${info.unit ?? "-"} · ${info.sample}`);
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const opts = parseCliOptions();
  const supabase = createAdminClient();

  if (opts.dumpTags) {
    await dumpTags(supabase, opts);
    return;
  }

  const stages =
    opts.stage === "all" ? (["index", "files", "indicators", "topics", "canon"] as const) : ([opts.stage] as const);
  const summaries: string[] = [];
  if (stages.includes("index")) summaries.push(await syncIndex(supabase, opts));
  if (stages.includes("files")) summaries.push(await archiveFiles(supabase, opts));
  if (stages.includes("indicators")) summaries.push(await extractIndicators(supabase, opts));
  if (stages.includes("topics")) summaries.push(await extractTopics(supabase, opts));
  if (stages.includes("canon")) summaries.push(await canonTopics(supabase, opts));

  console.log(`\n${process.exitCode ? "✗ brsr scrape finished with errors" : "✓ brsr scrape complete"} — ${summaries.join(" · ")}`);
}

main().catch((e) => {
  console.error("brsr scrape failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
