import { z } from "zod";

/** Parse context threaded through every module's parseConfig (viz-engine shape). */
export interface ParseCtx {
  slug: string;
  label: string;
}

/** Run raw layer config through the module's zod schema, rethrowing failures as
 *  `${ctx.label}: …` (the viz-engine error contract). Local copy — viz-engine's
 *  own parseWithSchema isn't exported from its package index. */
export function parseWithSchema<S extends z.ZodTypeAny>(
  schema: S,
  raw: unknown,
  ctx: ParseCtx
): z.output<S> {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const path = issue.path.join(".");
  throw new Error(`${ctx.label}: ${path ? `'${path}' — ` : ""}${issue.message}`);
}

/**
 * Route a remote image through the same-origin proxy. News CDNs often refuse
 * hotlinked requests, and the export's headless browser must load every image
 * from OUR origin (the proxy is on the middleware's public list). Data URLs and
 * app-relative paths pass through untouched.
 */
export function proxiedImage(src: string): string {
  if (!src || src.startsWith("data:") || src.startsWith("/")) return src;
  return `/api/share-cards/image-proxy?url=${encodeURIComponent(src)}`;
}

/** Format an ISO date the way the pipeline page does (e.g. "04 Jun 2026"). */
export function cardDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** cardDate for date-ONLY columns ("YYYY-MM-DD", e.g. jobs' posted_on /
 *  application_deadline). `new Date("YYYY-MM-DD")` parses as UTC midnight, so
 *  cardDate would show the previous day west of UTC — split manually instead
 *  (same fix as the platform board's fmtDate). */
export function cardDateOnly(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || m > 12) return iso;
  return `${String(d).padStart(2, "0")} ${MONTHS_SHORT[m - 1]} ${y}`;
}
