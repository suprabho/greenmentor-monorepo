import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Store for Agent Studio package edits (see supabase/migrations/0003).
 *
 * The bundled files in agents/ are the base layer; these rows are laid over them at
 * read time. Not org-scoped — an agent package is platform configuration, global the
 * same way the files in the repo are — so unlike the rest of lib/db these functions
 * take no orgId. `updatedBy` carries the audit trail.
 *
 * Reads degrade rather than throw: if Supabase is unreachable or unconfigured, the
 * caller gets `{}` and runs on the deployed package. A hard failure here would take
 * the whole agent pipeline down over an edit-store blip, which is a far worse
 * outcome than running the known-good bundled prompt. Writes DO throw — a save that
 * silently didn't happen is the one thing worse than an error message.
 */

const TABLE = "esg_agent_package_files";

/** file id -> content, for one agent. */
export type PackageOverrides = Record<string, string>;

function configured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function readOverrides(agentKey: string): Promise<PackageOverrides> {
  if (!configured()) return {};
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from(TABLE)
      .select("file, content")
      .eq("agent_key", agentKey);
    if (error) throw new Error(error.message);
    return Object.fromEntries((data ?? []).map((r) => [r.file as string, r.content as string]));
  } catch (e) {
    console.warn(`[agentPackages] readOverrides(${agentKey}) failed, using bundled package:`, e);
    return {};
  }
}

/** agentKey -> (file id -> content). One round trip for the whole Studio rail. */
export async function readAllOverrides(): Promise<Record<string, PackageOverrides>> {
  if (!configured()) return {};
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from(TABLE).select("agent_key, file, content");
    if (error) throw new Error(error.message);
    const out: Record<string, PackageOverrides> = {};
    for (const r of data ?? []) {
      const key = r.agent_key as string;
      (out[key] ??= {})[r.file as string] = r.content as string;
    }
    return out;
  } catch (e) {
    console.warn("[agentPackages] readAllOverrides failed, using bundled packages:", e);
    return {};
  }
}

export async function writeOverride(
  agentKey: string,
  file: string,
  content: string,
  updatedBy: string | null,
): Promise<void> {
  if (!configured()) {
    throw new Error("writeOverride: Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from(TABLE)
    .upsert({ agent_key: agentKey, file, content, updated_by: updatedBy }, { onConflict: "agent_key,file" });
  if (error) throw new Error(`writeOverride: ${error.message}`);
}

/** Drop a stored edit so the file falls back to the deployed package. */
export async function deleteOverride(agentKey: string, file: string): Promise<void> {
  if (!configured()) throw new Error("deleteOverride: Supabase is not configured");
  const admin = createAdminClient();
  const { error } = await admin.from(TABLE).delete().eq("agent_key", agentKey).eq("file", file);
  if (error) throw new Error(`deleteOverride: ${error.message}`);
}
