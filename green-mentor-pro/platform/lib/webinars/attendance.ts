/**
 * Recording who actually turned up. Before migration 0024 the platform captured
 * nothing: attendance was an integer an admin typed into community_webinars
 * after the fact. Now a learner joining the embedded Zoom player writes a row to
 * webinar_attendance, and the community-engine admin hub reads it alongside the
 * RSVP list.
 *
 * Two callers, both server-side: the zoom-signature route (an actual join) and
 * the heartbeat route (still watching). webinar_attendance has RLS enabled with
 * no policies, so both go through the service-role client — a learner can't see
 * or forge attendance, theirs or anyone's.
 *
 * Scope worth stating: this only sees people who join *through the platform*.
 * Anyone who opens the meeting in the Zoom app directly is invisible here until
 * an admin imports Zoom's participant report, which merges onto the same rows.
 */

import type { User } from "@supabase/supabase-js";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";

/**
 * Best guess at how to reach this learner, for the admin's attendee list.
 * Prefers the contact details they gave when RSVPing to *this* webinar, then
 * their profile, then the account itself.
 */
async function resolveContact(
  admin: ReturnType<typeof createAdminClient>,
  webinarId: string,
  user: User
): Promise<{ fullName: string | null; email: string | null; phone: string | null }> {
  const [rsvp, profile] = await Promise.all([
    admin
      .from("webinar_rsvps")
      .select("full_name, email, phone")
      .eq("user_id", user.id)
      .eq("webinar_id", webinarId)
      .maybeSingle(),
    admin.from("profiles").select("display_name, phone").eq("id", user.id).maybeSingle(),
  ]);
  const r = rsvp.data as { full_name: string | null; email: string | null; phone: string | null } | null;
  const p = profile.data as { display_name: string | null; phone: string | null } | null;
  const metaName = user.user_metadata?.full_name as string | undefined;
  return {
    fullName: r?.full_name ?? p?.display_name ?? metaName ?? null,
    email: r?.email ?? user.email ?? null,
    phone: r?.phone ?? p?.phone ?? null,
  };
}

/**
 * Upsert the learner's attendance row for a webinar.
 *
 * `countJoin` separates a real join (bump join_count) from a heartbeat (only
 * move last_seen_at) — see the record_webinar_join function in migration 0024,
 * which does it in one statement so two tabs can't race the counter.
 *
 * Never throws. Attendance is analytics: failing to record it must not stop a
 * learner from joining the session they came for. Returns whether it landed, so
 * a caller that cares can tell.
 */
export async function recordWebinarJoin(
  webinarId: string,
  user: User,
  { countJoin }: { countJoin: boolean }
): Promise<boolean> {
  if (!isServiceRoleConfigured()) return false;
  try {
    const admin = createAdminClient();
    const contact = await resolveContact(admin, webinarId, user);
    const { error } = await admin.rpc("record_webinar_join", {
      p_webinar_id: webinarId,
      p_user_id: user.id,
      p_full_name: contact.fullName,
      p_email: contact.email,
      p_phone: contact.phone,
      p_count_join: countJoin,
    });
    if (error) {
      console.error("[webinar-attendance] could not record join", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[webinar-attendance] could not record join", e);
    return false;
  }
}
