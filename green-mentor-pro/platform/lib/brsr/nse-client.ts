/**
 * NSE India HTTP client for the BRSR filings scraper (scripts/scrape-brsr.ts).
 *
 * Every outbound request to NSE goes through this module so the politeness
 * rules can't be bypassed: strictly sequential, ~1 req/s + jitter, browser-like
 * headers, and an Akamai-aware retry ladder. NSE's index API answered plain
 * requests when probed, but the site intermittently enforces cookie challenges,
 * so each session "warms up" by loading the listing page first and carrying its
 * cookies (ak_bmsc / bm_sv etc.) into the API calls, exactly like the browser.
 *
 * Blocked responses (401/403/429, timeouts, or challenge HTML served as 200)
 * throw BlockedError; withRetry() re-warms the session and backs off before
 * retrying, and callers treat a still-blocked item as failed-but-resumable.
 */

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const WARMUP_URL =
  "https://www.nseindia.com/companies-listing/corporate-filings-bussiness-sustainabilitiy-reports";
// NSE's own spelling — "bussiness sustainabilitiy" — do not "fix" it.
const INDEX_URL = "https://www.nseindia.com/api/corporate-bussiness-sustainabilitiy";

const RATE_MS = Number(process.env.BRSR_RATE_MS ?? 1000);
const MAX_ATTEMPTS = Number(process.env.BRSR_MAX_ATTEMPTS ?? 4);
const BACKOFF_MS = [2_000, 8_000, 30_000];
const SESSION_TTL_MS = 25 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30_000;

/** One filing row as NSE's index API returns it ({"data": [...]}). Fields are
 * typed loosely — NSE payloads drift and use "-" as a null sentinel. */
export type NseFilingRaw = {
  companyName?: string;
  symbol?: string;
  fyFrom?: number | string;
  fyTo?: number | string;
  submissionDate?: string; // "10-Jul-2026"
  revisionDate?: string; // "-" or a date
  attachmentFile?: string; // PDF on nsearchives.nseindia.com
  attFileSize?: string; // "1.12 MB"
  xbrlFile?: string; // XBRL XML on nsearchives.nseindia.com
  xbrlFileSize?: string;
};

/** A response that means "NSE doesn't want to talk to this session right now". */
export class BlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedError";
  }
}

/** The file is permanently gone (404) — retrying or re-warming won't help.
 * NSE's index carries dead links for many pre-FY2023-24 filings. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

let cookieHeader = "";
let warmedAt = 0;
let lastRequestAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Enforce the sequential rate limit: RATE_MS + 0–400ms jitter between requests. */
async function throttle(): Promise<void> {
  const wait = lastRequestAt + RATE_MS + Math.random() * 400 - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

function browserHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "user-agent": USER_AGENT,
    "accept-language": "en-US,en;q=0.9",
    ...(cookieHeader ? { cookie: cookieHeader } : {}),
    ...extra,
  };
}

/** GET the BRSR listing page and capture its cookies into the session jar. */
async function warmUp(): Promise<void> {
  cookieHeader = "";
  await throttle();
  const res = await fetch(WARMUP_URL, {
    headers: browserHeaders({ accept: "text/html,application/xhtml+xml" }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: "follow",
  });
  cookieHeader = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
  warmedAt = Date.now();
  if (!res.ok) throw new BlockedError(`warm-up got HTTP ${res.status}`);
}

/** Akamai serves its challenge as 200 text/html — never trust status alone. */
function looksLikeChallenge(body: string): boolean {
  return /^\uFEFF?\s*<(!doctype\s+html|html)/i.test(body.slice(0, 200));
}

async function requestOnce(url: string, accept: string): Promise<Response> {
  if (!cookieHeader || Date.now() - warmedAt > SESSION_TTL_MS) await warmUp();
  await throttle();
  const res = await fetch(url, {
    headers: browserHeaders({ accept, referer: WARMUP_URL }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if ([401, 403, 429].includes(res.status)) {
    throw new BlockedError(`HTTP ${res.status} from ${new URL(url).host}`);
  }
  if (res.status === 404) throw new NotFoundError(`HTTP 404 from ${new URL(url).host}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res;
}

/** Retry ladder: any failure → fresh session + exponential backoff, MAX_ATTEMPTS total. */
async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (e instanceof NotFoundError) break; // permanent — retrying won't help
      if (attempt === MAX_ATTEMPTS) break;
      const wait = BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)];
      const why = e instanceof Error ? e.message : String(e);
      console.warn(`  [nse] ${label} attempt ${attempt} failed (${why}) — re-warming, retry in ${wait / 1000}s`);
      cookieHeader = ""; // force a fresh session on the next request
      await sleep(wait);
    }
  }
  throw lastError;
}

/**
 * Fetch the BRSR filing index. Without dates NSE returns its default rolling
 * ~1-year window; pass DD-MM-YYYY strings to window a historical backfill.
 */
export async function fetchIndex(fromDate?: string, toDate?: string): Promise<NseFilingRaw[]> {
  const url = new URL(INDEX_URL);
  url.searchParams.set("index", "equities");
  if (fromDate) url.searchParams.set("from_date", fromDate);
  if (toDate) url.searchParams.set("to_date", toDate);

  return withRetry(`index ${fromDate ?? "default"}→${toDate ?? ""}`, async () => {
    const res = await requestOnce(url.toString(), "application/json");
    const body = await res.text();
    if (looksLikeChallenge(body)) throw new BlockedError("challenge HTML where JSON expected");
    const parsed = JSON.parse(body) as { data?: NseFilingRaw[] };
    if (!Array.isArray(parsed.data)) throw new Error("index response has no data[]");
    return parsed.data;
  });
}

/** Download one archive file (XBRL) from nsearchives.nseindia.com. */
export async function fetchFile(url: string): Promise<Buffer> {
  return withRetry(`file ${url.split("/").pop()}`, async () => {
    const res = await requestOnce(url, "*/*");
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0) throw new BlockedError("empty body");
    if (looksLikeChallenge(bytes.subarray(0, 200).toString("utf8"))) {
      throw new BlockedError("challenge HTML where file expected");
    }
    return bytes;
  });
}
