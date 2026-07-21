import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The Academy's live webinars — scheduling/publishing fields plus the
 * post-webinar sales-funnel metrics that replace the old tracker sheet.
 * `community_webinars` has RLS enabled with no policies (see migration
 * 0005), so every call here expects the service-role client — callers must
 * already be past the requireAdmin() gate. Learners see published rows via
 * the `webinars_public` view, which never exposes the metrics.
 */
export const WEBINARS_TABLE = "community_webinars";
export const RSVPS_TABLE = "webinar_rsvps";

export type WebinarStatus = "draft" | "published" | "completed" | "archived";

/** Metric columns are nullable until the team fills them in post-webinar. */
export const WEBINAR_METRIC_FIELDS = [
  "registrations",
  "attendees",
  "interest_shown",
  "unique_attendees",
  "sales_calls_booked",
  "buyers",
  "avg_ticket_inr",
  "revenue_inr",
] as const;

export type WebinarMetricField = (typeof WEBINAR_METRIC_FIELDS)[number];

export interface WebinarRow {
  id: string;
  title: string;
  hook: string | null;
  /** References into community_instructors (migration 0009). */
  instructor_ids: string[];
  scheduled_at: string | null;
  duration_minutes: number | null;
  registration_url: string | null;
  creatives_url: string | null;
  cover_image_url: string | null;
  /** Zoom Meeting SDK join credentials for the embedded player. Admin-only —
   *  never exposed through webinars_public; the platform mints a join
   *  signature from these behind an auth gate. */
  zoom_meeting_number: string | null;
  zoom_passcode: string | null;
  status: WebinarStatus;
  registrations: number | null;
  attendees: number | null;
  interest_shown: number | null;
  unique_attendees: number | null;
  sales_calls_booked: number | null;
  buyers: number | null;
  avg_ticket_inr: number | null;
  revenue_inr: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type WebinarEditableFields = Partial<
  Pick<
    WebinarRow,
    | "title"
    | "hook"
    | "instructor_ids"
    | "scheduled_at"
    | "duration_minutes"
    | "registration_url"
    | "creatives_url"
    | "cover_image_url"
    | "zoom_meeting_number"
    | "zoom_passcode"
    | "status"
    | "notes"
    | WebinarMetricField
  >
>;

export async function listWebinars(supabase: SupabaseClient): Promise<WebinarRow[]> {
  const { data, error } = await supabase
    .from(WEBINARS_TABLE)
    .select("*")
    .order("scheduled_at", { ascending: false, nullsFirst: true });
  if (error) throw new Error(error.message);
  return (data as WebinarRow[]) ?? [];
}

export async function getWebinar(supabase: SupabaseClient, id: string): Promise<WebinarRow | null> {
  const { data, error } = await supabase.from(WEBINARS_TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as WebinarRow | null) ?? null;
}

export async function insertWebinar(
  supabase: SupabaseClient,
  input: WebinarEditableFields & { title: string }
): Promise<WebinarRow> {
  const { data, error } = await supabase.from(WEBINARS_TABLE).insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data as WebinarRow;
}

export async function updateWebinar(
  supabase: SupabaseClient,
  id: string,
  input: WebinarEditableFields
): Promise<void> {
  const { error } = await supabase.from(WEBINARS_TABLE).update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteWebinar(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from(WEBINARS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * RSVP counts per webinar, from the platform-side `webinar_rsvps` table
 * (migration 0010 there — counts read 0 until it's applied). RLS restricts
 * rows to their owners, so this too requires the service-role client.
 */
export async function listRsvpCounts(supabase: SupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await supabase.from(RSVPS_TABLE).select("webinar_id");
  if (error) {
    // Table missing (platform migration 0010 not applied yet) shouldn't break
    // the panel — PostgREST reports it as PGRST205, raw Postgres as 42P01.
    if (error.code === "42P01" || error.code === "PGRST205") return {};
    throw new Error(error.message);
  }
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { webinar_id: string }[]) {
    counts[row.webinar_id] = (counts[row.webinar_id] ?? 0) + 1;
  }
  return counts;
}
