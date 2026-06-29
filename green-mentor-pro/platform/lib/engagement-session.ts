import { createClient } from "@/lib/supabase/server";
import { ensureOrgForUser } from "@/lib/tenancy";

export interface EngagementContext {
  orgId: string;
  userId: string;
  email: string | null;
}

/**
 * Resolve the signed-in user's engagement context (org + user id) for engagement
 * API routes. Returns null when unauthenticated — the caller returns 401.
 */
export async function getEngagementContext(): Promise<EngagementContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const orgId = await ensureOrgForUser(user.id, user.email);
  return { orgId, userId: user.id, email: user.email ?? null };
}
