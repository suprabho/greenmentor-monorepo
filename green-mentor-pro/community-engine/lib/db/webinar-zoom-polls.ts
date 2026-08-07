import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZoomPollAnswer } from "@/lib/zoom/api";
import { listAttendance, listRsvps } from "@/lib/db/webinar-people";

/**
 * Zoom-native poll results (community-engine migration 0018). The live poll
 * ran on Zoom; after the session the sync route pulls the answers and stores
 * them here, one row per (respondent, question).
 *
 * Same contract as webinar-people: the table is RLS-on with no policies, so
 * every call needs the service-role client behind the requireAdmin() gate.
 * Reads degrade to empty when the migration hasn't been applied yet.
 */
export const ZOOM_POLL_ANSWERS_TABLE = "webinar_zoom_poll_answers";

/** PostgREST reports a missing table as PGRST205, raw Postgres as 42P01. */
function isMissingTable(error: { code?: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205";
}

export interface ZoomPollAnswerRow {
  id: string;
  webinar_id: string;
  respondent_name: string | null;
  respondent_email: string | null;
  matched_user_id: string | null;
  question: string;
  answer: string;
  answered_at: string | null;
  synced_at: string;
}

const COLUMNS =
  "id, webinar_id, respondent_name, respondent_email, matched_user_id, question, answer, answered_at, synced_at";

/** Stored Zoom poll answers for one webinar, grouped-friendly ordering. */
export async function listZoomPollAnswers(
  supabase: SupabaseClient,
  webinarId: string
): Promise<ZoomPollAnswerRow[]> {
  const { data, error } = await supabase
    .from(ZOOM_POLL_ANSWERS_TABLE)
    .select(COLUMNS)
    .eq("webinar_id", webinarId)
    .order("question", { ascending: true })
    .order("respondent_name", { ascending: true, nullsFirst: false });
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }
  return (data as ZoomPollAnswerRow[]) ?? [];
}

export interface ZoomPollSyncResult {
  /** Rows written (one per respondent × question). */
  inserted: number;
  /** Distinct people who answered at least one question. */
  respondents: number;
  /** How many of those resolved to a platform account. */
  matchedUsers: number;
}

/**
 * Replace a webinar's stored Zoom poll answers with a fresh pull.
 *
 * Respondents are matched back to platform accounts by email, using the same
 * sources the attendance import trusts: this webinar's attendance rows first
 * (they already carry resolved user_ids), then its RSVP snapshots. Zoom is
 * the source of truth for the answers themselves, so the previous rows are
 * deleted wholesale — callers must not pass an empty pull (keep whatever is
 * already stored instead of wiping it with nothing).
 */
export async function replaceZoomPollAnswers(
  supabase: SupabaseClient,
  webinarId: string,
  answers: ZoomPollAnswer[]
): Promise<ZoomPollSyncResult> {
  if (answers.length === 0) throw new Error("refusing to replace stored poll answers with an empty set");

  const [attendance, rsvps] = await Promise.all([
    listAttendance(supabase, webinarId),
    listRsvps(supabase, webinarId),
  ]);
  const userIdByEmail = new Map<string, string>();
  for (const r of rsvps) {
    if (r.email) userIdByEmail.set(r.email.toLowerCase(), r.user_id);
  }
  // Attendance last so its (already-resolved) user_ids win over RSVP snapshots.
  for (const r of attendance) {
    if (r.email && r.user_id) userIdByEmail.set(r.email.toLowerCase(), r.user_id);
  }

  const rows = answers.map((a) => {
    const email = a.email?.toLowerCase() ?? null;
    return {
      webinar_id: webinarId,
      respondent_name: a.name,
      respondent_email: email,
      matched_user_id: email ? userIdByEmail.get(email) ?? null : null,
      question: a.question,
      answer: a.answer,
      answered_at: a.answeredAt,
    };
  });

  const { error: deleteError } = await supabase
    .from(ZOOM_POLL_ANSWERS_TABLE)
    .delete()
    .eq("webinar_id", webinarId);
  if (deleteError) throw new Error(deleteError.message);

  const { error: insertError } = await supabase.from(ZOOM_POLL_ANSWERS_TABLE).insert(rows);
  if (insertError) throw new Error(insertError.message);

  const people = new Set<string>();
  const matched = new Set<string>();
  for (const r of rows) {
    people.add(r.respondent_email ?? `name:${(r.respondent_name ?? "unknown").toLowerCase()}`);
    if (r.matched_user_id) matched.add(r.matched_user_id);
  }
  return { inserted: rows.length, respondents: people.size, matchedUsers: matched.size };
}
