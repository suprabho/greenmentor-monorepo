import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Webinars are authored in the community-engine admin hub (community_webinars,
// RLS with no policies) and published to learners through the webinars_public
// view, which exposes only safe columns of published/completed rows — never
// the sales-funnel metrics. All reads here go through the RLS-bound server
// client, like lib/academy/repo.ts. RSVPs live in webinar_rsvps with an
// "own rows" policy, so the same client can only touch the signed-in user's.
//
// Instructors are referenced by id (webinars_public.instructor_ids → migration
// 0009) and resolved from community_instructors, which has a public read policy,
// so the same RLS-bound client can read the roster.

/** A webinar's instructor, resolved from the roster for display on the card. */
export interface WebinarInstructor {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  photo: string | null;
  initials: string;
}

export interface Webinar {
  id: string;
  title: string;
  hook: string | null;
  instructors: WebinarInstructor[];
  scheduledAt: string | null;
  durationMinutes: number | null;
  registrationUrl: string | null;
  coverImageUrl: string | null;
  status: "published" | "completed";
}

const WEBINAR_COLUMNS =
  "id, title, hook, instructor_ids, scheduled_at, duration_minutes, registration_url, cover_image_url, status";

interface WebinarRowRaw {
  id: string;
  title: string;
  hook: string | null;
  instructor_ids: string[] | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  registration_url: string | null;
  cover_image_url: string | null;
  status: string;
}

/** Fetch the instructors referenced across a set of webinar rows, keyed by id. */
async function resolveInstructors(
  supabase: SupabaseClient,
  rows: WebinarRowRaw[]
): Promise<Map<string, WebinarInstructor>> {
  const ids = [...new Set(rows.flatMap((r) => r.instructor_ids ?? []))];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("community_instructors")
    .select("id, name, role, company, photo, initials")
    .in("id", ids);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as WebinarInstructor[]).map((i) => [i.id, i]));
}

function mapWebinar(row: WebinarRowRaw, byId: Map<string, WebinarInstructor>): Webinar {
  return {
    id: row.id,
    title: row.title,
    hook: row.hook,
    instructors: (row.instructor_ids ?? [])
      .map((id) => byId.get(id))
      .filter((x): x is WebinarInstructor => Boolean(x)),
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
  const rows = (data ?? []) as WebinarRowRaw[];
  const byId = await resolveInstructors(supabase, rows);
  return rows.map((r) => mapWebinar(r, byId));
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
  const rows = (data ?? []) as WebinarRowRaw[];
  const byId = await resolveInstructors(supabase, rows);
  return rows.map((r) => mapWebinar(r, byId));
}

/** Webinar ids the signed-in user has RSVP'd to (empty when signed out). */
export async function fetchUserRsvpIds(userId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("webinar_rsvps").select("webinar_id").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.webinar_id as string));
}
