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
