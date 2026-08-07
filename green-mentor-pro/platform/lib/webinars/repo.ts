import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getWebinarPhase, UPCOMING_LOOKBACK_MS } from "@/lib/webinars/status";
import { parseShareParam, pickCanonical, shareSlug } from "@/lib/share/slug";
import { DEFAULT_COUNTRY_ISO } from "@/lib/data/country-codes";
import { fromE164 } from "@/lib/utils/validation";
import type { RsvpContactDefaults } from "@/lib/webinars/contact";
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
  /** Canonical URL segment, `{slug}-{idPrefix}`. Use webinarHref() to build a path. */
  shareSlug: string;
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
  "id, slug, id_prefix, title, hook, instructor_ids, scheduled_at, duration_minutes, registration_url, cover_image_url, status";

interface WebinarRowRaw {
  id: string;
  slug: string | null;
  id_prefix: string | null;
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
    shareSlug: shareSlug(row.slug, row.id),
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

// "Upcoming" spans a session's whole slot, not just the run-up to it — a
// webinar in progress has to stay on the card grid so latecomers can still
// join. PostgREST can't compare against scheduled_at + duration_minutes, so
// both queries take a superset and getWebinarPhase() applies the exact
// per-row end time in JS. That also keeps the two lists disjoint: a session
// that started ten minutes ago is upcoming, not past.

export async function fetchUpcomingWebinars(): Promise<Webinar[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webinars_public")
    .select(WEBINAR_COLUMNS)
    .eq("status", "published")
    .gte("scheduled_at", new Date(Date.now() - UPCOMING_LOOKBACK_MS).toISOString())
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as WebinarRowRaw[];
  const byId = await resolveInstructors(supabase, rows);
  return rows.map((r) => mapWebinar(r, byId)).filter((w) => getWebinarPhase(w) !== "ended");
}

/** Headroom for the in-progress rows dropped below, so `limit` still fills. */
const PAST_OVERFETCH = 8;

export async function fetchPastWebinars(limit = 12): Promise<Webinar[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webinars_public")
    .select(WEBINAR_COLUMNS)
    .lt("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: false })
    .limit(limit + PAST_OVERFETCH);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as WebinarRowRaw[];
  const byId = await resolveInstructors(supabase, rows);
  return rows
    .map((r) => mapWebinar(r, byId))
    .filter((w) => getWebinarPhase(w) === "ended")
    .slice(0, limit);
}

/** Webinar ids the signed-in user has RSVP'd to (empty when signed out). */
export async function fetchUserRsvpIds(userId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("webinar_rsvps").select("webinar_id").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.webinar_id as string));
}

/**
 * What the RSVP form starts with. Name, phone and country come from the profile
 * — onboarding already collected them (migration 0025) — with the account as
 * fallback, so a returning learner just confirms. `phone` is handed back as the
 * *national* number, which is what PhoneInput binds to. Empty strings, never
 * null: these feed controlled inputs.
 */
export async function fetchRsvpContactDefaults(user: User): Promise<RsvpContactDefaults> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name, phone, phone_country")
    .eq("id", user.id)
    .maybeSingle();
  const profile = data as { display_name: string | null; phone: string | null; phone_country: string | null } | null;
  const iso = profile?.phone_country ?? DEFAULT_COUNTRY_ISO;
  const metaName = user.user_metadata?.full_name as string | undefined;
  return {
    fullName: profile?.display_name ?? metaName ?? "",
    email: user.email ?? "",
    phone: fromE164(profile?.phone, iso),
    phoneCountry: iso,
  };
}

/** A single published/completed webinar, by raw uuid. */
export async function fetchWebinarById(id: string): Promise<Webinar | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("webinars_public").select(WEBINAR_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as WebinarRowRaw;
  const byId = await resolveInstructors(supabase, [row]);
  return mapWebinar(row, byId);
}

/**
 * Resolve a `[slug]` route param — either a share slug ("scope-3-3f8a1c2e9d")
 * or a bare uuid, so links minted before slugs existed still work. Callers
 * compare the result's shareSlug against the incoming param and redirect when
 * they differ, which is what keeps renamed items on stable URLs.
 */
export async function resolveWebinar(param: string): Promise<Webinar | null> {
  const parsed = parseShareParam(param);
  if (!parsed) return null;
  if (parsed.kind === "uuid") return fetchWebinarById(parsed.id);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webinars_public")
    .select(WEBINAR_COLUMNS)
    .eq("id_prefix", parsed.idPrefix)
    .limit(2); // 2 is enough to notice a prefix collision; pickCanonical breaks the tie
  if (error) throw new Error(error.message);
  const row = pickCanonical((data ?? []) as WebinarRowRaw[], parsed.slug);
  if (!row) return null;
  const byId = await resolveInstructors(supabase, [row]);
  return mapWebinar(row, byId);
}
