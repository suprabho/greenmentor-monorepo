import type { ToolContext } from "./types";

/**
 * Dispatch table mapping each tools.json name to a TENANT-SCOPED Supabase/EFDB call.
 * Tool inputs are already schema-valid (strict tool-use), so handlers trust the
 * shape but still enforce tenant scope server-side via `ctx`.
 *
 * These are stubs to be wired in M2 (see plan §14): search_emission_factors hits the
 * EFDB endpoint; query_workspace_dataset / fetch_prior_artifact run RLS-scoped selects.
 */
type ToolHandler = (input: unknown, ctx: ToolContext) => Promise<unknown>;

const HANDLERS: Record<string, ToolHandler> = {
  // EFDB — emission-factor lookup (Phase 6). Wire to the efdb FastAPI endpoint or
  // the `efdb` Supabase schema (asyncpg pooler). Returns ranked candidate factors.
  search_emission_factors: async (input) => {
    // TODO(M2): call EFDB /emission-factors with input.{activity_query,country_iso,year,ghg_scope}
    return { candidates: [], note: "search_emission_factors not yet wired (M2)" };
  },

  // Disclosure requirement lookup (Phase 3/6).
  lookup_disclosure_requirement: async (input) => {
    return { requirement: null, note: "lookup_disclosure_requirement not yet wired (M2)" };
  },

  // Prior-phase artifact fetch (tenant + financial_year scoped).
  fetch_prior_artifact: async (_input, ctx) => {
    return { artifact: null, ctx: { orgId: ctx.orgId, engagementId: ctx.engagementId } };
  },

  // Scoped read over the workspace dataset (RLS enforced server-side).
  query_workspace_dataset: async (_input, ctx) => {
    return { rows: [], ctx: { orgId: ctx.orgId, financialYear: ctx.financialYear } };
  },
};

export async function runCallableTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<unknown> {
  const handler = HANDLERS[name];
  if (!handler) {
    // The agent may only call tools declared in its package; an unknown name is a bug.
    return { error: `No handler registered for tool "${name}"` };
  }
  return handler(input, ctx);
}
