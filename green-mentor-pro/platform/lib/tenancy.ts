import { createAdminClient } from "@gm/orchestrator";

/**
 * Tenancy bridge: the engagement engine is org_id-scoped (esg_organizations /
 * esg_org_members), but the platform authenticates with Supabase Auth (a plain
 * user_id) — not esg-agents' legacy sealed-JWT "-um" system. So each platform
 * user gets a personal org on first use. Writes go through the service-role admin
 * client (RLS-bypassing), which is how every @gm/orchestrator DB repo operates.
 */
export async function ensureOrgForUser(userId: string, email?: string | null): Promise<string> {
  const admin = createAdminClient();

  const { data: member } = await admin
    .from("esg_org_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (member?.org_id) return member.org_id as string;

  const name = email ? `${email.split("@")[0]}'s workspace` : "Personal workspace";
  const { data: org, error } = await admin
    .from("esg_organizations")
    .insert({ name, slug: `org-${userId}` })
    .select("id")
    .single();
  if (error || !org) throw new Error(`ensureOrgForUser: ${error?.message ?? "no org row"}`);

  const { error: mErr } = await admin
    .from("esg_org_members")
    .insert({ org_id: org.id, user_id: userId, role: "admin" });
  if (mErr) throw new Error(`ensureOrgForUser (member): ${mErr.message}`);

  return org.id as string;
}
