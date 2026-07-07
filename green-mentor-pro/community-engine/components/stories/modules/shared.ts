import { z } from "zod";

/** Parse context threaded through every module's parseConfig (viz-engine shape). */
export interface ParseCtx {
  slug: string;
  label: string;
}

/** Run raw layer config through the module's zod schema, rethrowing failures as
 *  `${ctx.label}: …` (the viz-engine error contract). Local copy — viz-engine's
 *  own parseWithSchema isn't exported from its package index (same reason
 *  lib/share-cards/modules/shared.ts keeps its own copy). */
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
