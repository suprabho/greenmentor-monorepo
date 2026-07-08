import { createClient } from "@/lib/supabase/server";

// Webinars are authored in the community-engine admin hub (community_webinars,
// RLS with no policies) and published to learners through the webinars_public
// view, which exposes only safe columns of published/completed rows — never
// the sales-funnel metrics. All reads here go through the RLS-bound server
// client, like lib/academy/repo.ts. RSVPs live in webinar_rsvps with an
// "own rows" policy, so the same client can only touch the signed-in user's.

export interface Webinar {
  id: string;
  title: string;
  hook: string | null;
  instructors: string[];
  scheduledAt: string | null;
  durationMinutes: number | null;
  registrationUrl: string | null;
  coverImageUrl: string | null;
  status: "published" | "completed";
}

const WEBINAR_COLUMNS =
  "id, title, hook, instructors, scheduled_at, duration_minutes, registration_url, cover_image_url, status";

function mapWebinar(row: {
  id: string;
  title: string;
  hook: string | null;
  instructors: string[] | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  registration_url: string | null;
  cover_image_url: string | null;
  status: string;
}): Webinar {
  return {
    id: row.id,
    title: row.title,
    hook: row.hook,
    instructors: row.instructors ?? [],
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    registrationUrl: row.registration_url,
    coverImageUrl: row.cover_image_url,
    status: row.status as Webinar["status"],
  };
}

export async function fetchUpcomingWebinars(): Promise<Webinar[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webinars_public")
    .select(WEBINAR_COLUMNS)
    .eq("status", "published")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapWebinar);
}

export async function fetchPastWebinars(limit = 12): Promise<Webinar[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webinars_public")
    .select(WEBINAR_COLUMNS)
    .lt("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapWebinar);
}

/** Webinar ids the signed-in user has RSVP'd to (empty when signed out). */
export async function fetchUserRsvpIds(userId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("webinar_rsvps").select("webinar_id").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.webinar_id as string));
}
