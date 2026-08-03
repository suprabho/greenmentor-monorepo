import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZoomParticipant } from "@/lib/zoom/participant-csv";

/**
 * The people side of a webinar: who RSVP'd and who turned up, with the contact
 * details the team needs to follow up.
 *
 * Both tables are platform-side (platform migrations 0010 and 0024) but live in
 * the same Supabase project. `webinar_rsvps` is RLS'd to row owners and
 * `webinar_attendance` has RLS on with no policies at all, so every call here
 * requires the service-role client and callers must already be past the
 * requireAdmin() gate — same contract as lib/db/webinars.ts.
 *
 * Reads degrade gracefully when the platform migration hasn't been applied yet,
 * like listRsvpCounts: an empty list beats a broken panel.
 */
export const RSVPS_TABLE = "webinar_rsvps";
export const ATTENDANCE_TABLE = "webinar_attendance";

/** PostgREST reports a missing table as PGRST205, raw Postgres as 42P01. */
function isMissingTable(error: { code?: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205";
}

/** A missing *column* — migration 0010 applied but 0024 not yet. */
function isMissingColumn(error: { code?: string }): boolean {
  return error.code === "42703" || error.code === "PGRST204";
}

export interface WebinarRsvpRow {
  user_id: string;
  webinar_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export interface WebinarAttendanceRow {
  webinar_id: string;
  participant_key: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  joined_in_app: boolean;
  in_zoom_report: boolean;
  first_joined_at: string | null;
  last_seen_at: string | null;
  join_count: number;
  zoom_duration_minutes: number | null;
}

const RSVP_COLUMNS = "user_id, webinar_id, full_name, email, phone, created_at";
const ATTENDANCE_COLUMNS =
  "webinar_id, participant_key, user_id, full_name, email, phone, joined_in_app, in_zoom_report, first_joined_at, last_seen_at, join_count, zoom_duration_minutes";

/** RSVPs for one webinar, newest first. */
export async function listRsvps(supabase: SupabaseClient, webinarId: string): Promise<WebinarRsvpRow[]> {
  const { data, error } = await supabase
    .from(RSVPS_TABLE)
    .select(RSVP_COLUMNS)
    .eq("webinar_id", webinarId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error)) return [];
    // 0024 not applied: fall back to the bare rows so counts still work.
    if (isMissingColumn(error)) {
      const { data: bare, error: bareErr } = await supabase
        .from(RSVPS_TABLE)
        .select("user_id, webinar_id, created_at")
        .eq("webinar_id", webinarId)
        .order("created_at", { ascending: false });
      if (bareErr) throw new Error(bareErr.message);
      return ((bare ?? []) as { user_id: string; webinar_id: string; created_at: string }[]).map((r) => ({
        ...r,
        full_name: null,
        email: null,
        phone: null,
      }));
    }
    throw new Error(error.message);
  }
  return (data as WebinarRsvpRow[]) ?? [];
}

/** Attendance rows for one webinar — in-app joins and Zoom-report imports. */
export async function listAttendance(
  supabase: SupabaseClient,
  webinarId: string
): Promise<WebinarAttendanceRow[]> {
  const { data, error } = await supabase
    .from(ATTENDANCE_TABLE)
    .select(ATTENDANCE_COLUMNS)
    .eq("webinar_id", webinarId)
    .order("first_joined_at", { ascending: true, nullsFirst: false });
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }
  return (data as WebinarAttendanceRow[]) ?? [];
}

/** Attendee counts per webinar, for the row chips in the panel. */
export async function listAttendanceCounts(supabase: SupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await supabase.from(ATTENDANCE_TABLE).select("webinar_id");
  if (error) {
    if (isMissingTable(error)) return {};
    throw new Error(error.message);
  }
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { webinar_id: string }[]) {
    counts[row.webinar_id] = (counts[row.webinar_id] ?? 0) + 1;
  }
  return counts;
}

export interface ZoomMergeResult {
  /** Rows that landed on an existing attendee (in-app joiner or an earlier import). */
  matched: number;
  /** Rows for people we hadn't seen at all — Zoom-only guests. */
  created: number;
}

/**
 * Merge a parsed Zoom report into webinar_attendance.
 *
 * The point is convergence: a learner who joined through the platform *and*
 * appears in Zoom's report must end up as one attendee, not two. Attendance rows
 * are keyed by `participant_key` — the user's id when we know them, otherwise
 * their email — so before writing we resolve each report email back to a user
 * via the existing attendance rows and this webinar's RSVPs. Anyone we can't
 * resolve is kept as a guest keyed by email (or by name, for dial-ins Zoom gives
 * no email at all).
 *
 * Writes are read-merge-write rather than a plain upsert: a report that happens
 * not to carry phone numbers must not blank out numbers we collected at RSVP,
 * and importing must never reset an in-app joiner's join_count.
 */
export async function mergeZoomParticipants(
  supabase: SupabaseClient,
  webinarId: string,
  participants: ZoomParticipant[]
): Promise<ZoomMergeResult> {
  if (participants.length === 0) return { matched: 0, created: 0 };

  const [existing, rsvps] = await Promise.all([
    listAttendance(supabase, webinarId),
    listRsvps(supabase, webinarId),
  ]);

  const byKey = new Map(existing.map((r) => [r.participant_key, r]));

  // email → the participant_key it should merge onto.
  const keyByEmail = new Map<string, string>();
  for (const r of existing) {
    if (r.email) keyByEmail.set(r.email.toLowerCase(), r.participant_key);
  }
  // RSVP snapshots let us recognise someone who never joined in-app.
  for (const r of rsvps) {
    if (r.email && !keyByEmail.has(r.email.toLowerCase())) keyByEmail.set(r.email.toLowerCase(), r.user_id);
  }
  // A known learner's phone, for guests the report doesn't carry one for.
  const phoneByEmail = new Map<string, string>();
  for (const r of rsvps) {
    if (r.email && r.phone) phoneByEmail.set(r.email.toLowerCase(), r.phone);
  }
  const userIdByEmail = new Map<string, string>();
  for (const r of rsvps) {
    if (r.email) userIdByEmail.set(r.email.toLowerCase(), r.user_id);
  }

  const earliest = (a: string | null, b: string | null): string | null =>
    a && b ? (a < b ? a : b) : (a ?? b);
  const latest = (a: string | null, b: string | null): string | null => (a && b ? (a > b ? a : b) : (a ?? b));

  // Accumulated by participant_key rather than pushed to a list: two report
  // entries can resolve to the same person (their in-app row carries one address
  // and their RSVP another, so both emails map to the same user id). Sending the
  // same key twice in one upsert makes Postgres throw "ON CONFLICT DO UPDATE
  // command cannot affect row a second time", so they're folded together here.
  const rows = new Map<string, Record<string, unknown>>();
  let matched = 0;
  let created = 0;

  for (const p of participants) {
    const email = p.email?.toLowerCase() ?? null;
    const key =
      (email ? keyByEmail.get(email) : undefined) ??
      email ??
      `name:${(p.fullName ?? "unknown").toLowerCase()}`;

    const pending = rows.get(key);
    if (!pending) {
      const prior = byKey.get(key);
      if (prior) matched++;
      else created++;
      rows.set(key, {
        webinar_id: webinarId,
        participant_key: key,
        user_id: prior?.user_id ?? (email ? userIdByEmail.get(email) ?? null : null),
        full_name: p.fullName ?? prior?.full_name ?? null,
        email: email ?? prior?.email ?? null,
        // Prefer a number the person gave us over whatever Zoom happens to hold.
        phone: prior?.phone ?? (email ? phoneByEmail.get(email) : undefined) ?? p.phone ?? null,
        joined_in_app: prior?.joined_in_app ?? false,
        in_zoom_report: true,
        first_joined_at: earliest(prior?.first_joined_at ?? null, p.joinedAt),
        last_seen_at: latest(prior?.last_seen_at ?? null, p.leftAt),
        join_count: prior?.join_count ?? 0,
        zoom_duration_minutes: p.durationMinutes ?? prior?.zoom_duration_minutes ?? null,
      });
      continue;
    }
    // Same person twice — widen the window and add the time, like a rejoin.
    pending.full_name ??= p.fullName;
    pending.email ??= email;
    pending.phone ??= p.phone;
    pending.first_joined_at = earliest(pending.first_joined_at as string | null, p.joinedAt);
    pending.last_seen_at = latest(pending.last_seen_at as string | null, p.leftAt);
    if (p.durationMinutes != null) {
      pending.zoom_duration_minutes = ((pending.zoom_duration_minutes as number | null) ?? 0) + p.durationMinutes;
    }
  }

  const { error } = await supabase
    .from(ATTENDANCE_TABLE)
    .upsert([...rows.values()], { onConflict: "webinar_id,participant_key" });
  if (error) throw new Error(error.message);

  return { matched, created };
}
