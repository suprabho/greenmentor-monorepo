import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LegacyJwtClaims } from "@/lib/auth/jwt";
import { legacyUuid } from "./identity";

/**
 * Map a legacy -um identity onto a Supabase org. Because the user authenticates
 * against -um (not Supabase Auth), there is no auth.uid() and RLS is dormant — all
 * writes go through the service-role admin client and MUST scope by org_id. The
 * legacy org is keyed by a deterministic slug "legacy:<id>"; membership is stored in
 * esg_organizations.config.members (the esg_org_members.user_id FK to auth.users
 * can't hold a legacy id).
 */
export interface ResolvedOrg {
  orgUuid: string;
  orgLegacyId: string;
  orgName: string;
  userUuid: string;
  role: string;
}

export async function resolveOrg(claims: LegacyJwtClaims): Promise<ResolvedOrg> {
  const admin = createAdminClient();
  const orgLegacyId = String(claims.organization.id);
  const orgName = claims.organization.name || `Organization ${orgLegacyId}`;
  const slug = `legacy:${orgLegacyId}`;
  const userLegacyId = String(claims.user.id);
  const userUuid = legacyUuid("user", userLegacyId);
  const role = mapRole(claims.member?.role_type);

  // Upsert the org row on its unique slug; read back the existing config to merge members.
  const { data: existing } = await admin
    .from("esg_organizations")
    .select("id, config")
    .eq("slug", slug)
    .maybeSingle();

  const prevConfig = (existing?.config ?? {}) as Record<string, unknown>;
  const prevMembers = (prevConfig.members ?? {}) as Record<string, { uuid: string; role: string; email?: string }>;
  const members = {
    ...prevMembers,
    [userLegacyId]: { uuid: userUuid, role, email: claims.user.email },
  };
  const config = {
    ...prevConfig,
    legacy: { org_id: orgLegacyId, name: orgName, company_code: claims.organization.company_code },
    members,
  };

  const { data, error } = await admin
    .from("esg_organizations")
    .upsert(
      { ...(existing?.id ? { id: existing.id } : {}), name: orgName, slug, config },
      { onConflict: "slug" },
    )
    .select("id")
    .single();

  if (error || !data) throw new Error(`resolveOrg failed: ${error?.message ?? "no row"}`);

  return { orgUuid: data.id as string, orgLegacyId, orgName, userUuid, role };
}

function mapRole(roleType?: string): string {
  const r = (roleType ?? "").toLowerCase();
  if (r === "admin") return "admin";
  if (r.includes("review")) return "reviewer";
  if (r.includes("view") || r.includes("client")) return "client_viewer";
  return "consultant";
}
