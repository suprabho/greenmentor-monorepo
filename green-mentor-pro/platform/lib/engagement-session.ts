import { cache } from "react";
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
 * Per-request memoized (React cache): the ai-hub and chat layouts both resolve
 * it in one render pass, and each uncached call is an auth round-trip.
 */
export const getEngagementContext = cache(async (): Promise<EngagementContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const orgId = await ensureOrgForUser(user.id, user.email);
  return { orgId, userId: user.id, email: user.email ?? null };
});
