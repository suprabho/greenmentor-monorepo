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

/** A single published/completed webinar, for the live page header. */
export async function fetchWebinarById(id: string): Promise<Webinar | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("webinars_public").select(WEBINAR_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as WebinarRowRaw;
  const byId = await resolveInstructors(supabase, [row]);
  return mapWebinar(row, byId);
}

// ── Live polls ──────────────────────────────────────────────────────────────
// Polls are authored in community-engine and exposed to learners through the
// webinar_polls_public / webinar_poll_options_public views (community-engine
// migration 0016). Answers live in webinar_poll_responses (platform migration
// 0023) under an "own rows" RLS policy, and aggregate counts come from the
// webinar_poll_results SECURITY DEFINER view.

export interface WebinarPollOption {
  id: string;
  label: string;
}

export interface WebinarPoll {
  id: string;
  question: string;
  options: WebinarPollOption[];
}

/** Published polls (with options, in display order) for a webinar. */
export async function fetchWebinarPolls(webinarId: string): Promise<WebinarPoll[]> {
  const supabase = await createClient();
  const { data: polls, error } = await supabase
    .from("webinar_polls_public")
    .select("id, question, position")
    .eq("webinar_id", webinarId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  const pollRows = (polls ?? []) as { id: string; question: string; position: number }[];
  if (pollRows.length === 0) return [];

  const { data: opts, error: optErr } = await supabase
    .from("webinar_poll_options_public")
    .select("id, poll_id, label, position")
    .in(
      "poll_id",
      pollRows.map((p) => p.id)
    )
    .order("position", { ascending: true });
  if (optErr) throw new Error(optErr.message);

  const byPoll = new Map<string, WebinarPollOption[]>();
  for (const o of (opts ?? []) as { id: string; poll_id: string; label: string }[]) {
    const list = byPoll.get(o.poll_id);
    if (list) list.push({ id: o.id, label: o.label });
    else byPoll.set(o.poll_id, [{ id: o.id, label: o.label }]);
  }
  return pollRows.map((p) => ({ id: p.id, question: p.question, options: byPoll.get(p.id) ?? [] }));
}

/** The signed-in user's chosen option per poll (poll_id → option_id). RLS
 *  "own rows" scopes this to the current user, so no explicit user filter. */
export async function fetchUserPollResponses(pollIds: string[]): Promise<Record<string, string>> {
  if (pollIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webinar_poll_responses")
    .select("poll_id, option_id")
    .in("poll_id", pollIds);
  if (error) throw new Error(error.message);
  const map: Record<string, string> = {};
  for (const r of (data ?? []) as { poll_id: string; option_id: string }[]) map[r.poll_id] = r.option_id;
  return map;
}

/** Aggregate vote counts: poll_id → { option_id → votes }. */
export async function fetchPollResults(pollIds: string[]): Promise<Record<string, Record<string, number>>> {
  if (pollIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webinar_poll_results")
    .select("poll_id, option_id, votes")
    .in("poll_id", pollIds);
  if (error) throw new Error(error.message);
  const map: Record<string, Record<string, number>> = {};
  for (const r of (data ?? []) as { poll_id: string; option_id: string; votes: number }[]) {
    (map[r.poll_id] ??= {})[r.option_id] = r.votes;
  }
  return map;
}
