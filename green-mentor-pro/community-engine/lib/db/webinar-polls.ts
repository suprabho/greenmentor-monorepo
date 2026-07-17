import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Static polls attached to a webinar — a question with an ordered set of
 * options. `webinar_polls` / `webinar_poll_options` have RLS enabled with no
 * policies (migration 0016), so every call here expects the service-role
 * client — callers must already be past the requireAdmin() gate. Learners read
 * published polls via the *_public views and answer them in the platform-side
 * webinar_poll_responses table.
 */
export const WEBINAR_POLLS_TABLE = "webinar_polls";
export const WEBINAR_POLL_OPTIONS_TABLE = "webinar_poll_options";

export type WebinarPollStatus = "draft" | "published" | "closed";

export interface WebinarPollOptionRow {
  id: string;
  poll_id: string;
  label: string;
  position: number;
  created_at: string;
}

export interface WebinarPollRow {
  id: string;
  webinar_id: string;
  question: string;
  status: WebinarPollStatus;
  position: number;
  created_at: string;
  updated_at: string;
}

/** A poll plus its options, in display order — the shape the admin panel edits. */
export interface WebinarPollWithOptions extends WebinarPollRow {
  options: WebinarPollOptionRow[];
}

/** All polls for a webinar (with options), ordered by position then creation. */
export async function listPolls(
  supabase: SupabaseClient,
  webinarId: string
): Promise<WebinarPollWithOptions[]> {
  const { data: polls, error } = await supabase
    .from(WEBINAR_POLLS_TABLE)
    .select("*")
    .eq("webinar_id", webinarId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (polls as WebinarPollRow[]) ?? [];
  if (rows.length === 0) return [];

  const { data: options, error: optErr } = await supabase
    .from(WEBINAR_POLL_OPTIONS_TABLE)
    .select("*")
    .in(
      "poll_id",
      rows.map((p) => p.id)
    )
    .order("position", { ascending: true });
  if (optErr) throw new Error(optErr.message);
  const byPoll = new Map<string, WebinarPollOptionRow[]>();
  for (const opt of (options as WebinarPollOptionRow[]) ?? []) {
    const list = byPoll.get(opt.poll_id);
    if (list) list.push(opt);
    else byPoll.set(opt.poll_id, [opt]);
  }
  return rows.map((p) => ({ ...p, options: byPoll.get(p.id) ?? [] }));
}

export async function insertPoll(
  supabase: SupabaseClient,
  input: { webinar_id: string; question: string; status?: WebinarPollStatus; position?: number }
): Promise<WebinarPollRow> {
  const { data, error } = await supabase
    .from(WEBINAR_POLLS_TABLE)
    .insert({
      webinar_id: input.webinar_id,
      question: input.question,
      status: input.status ?? "draft",
      position: input.position ?? 0,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as WebinarPollRow;
}

/** Scoped by both ids — the service-role client bypasses RLS, so scoping the
 *  update to (pollId, webinarId) stops a mismatched URL touching another
 *  webinar's poll. */
export async function updatePoll(
  supabase: SupabaseClient,
  webinarId: string,
  pollId: string,
  patch: Partial<Pick<WebinarPollRow, "question" | "status" | "position">>
): Promise<void> {
  const { error } = await supabase
    .from(WEBINAR_POLLS_TABLE)
    .update(patch)
    .eq("id", pollId)
    .eq("webinar_id", webinarId);
  if (error) throw new Error(error.message);
}

export async function deletePoll(
  supabase: SupabaseClient,
  webinarId: string,
  pollId: string
): Promise<void> {
  const { error } = await supabase
    .from(WEBINAR_POLLS_TABLE)
    .delete()
    .eq("id", pollId)
    .eq("webinar_id", webinarId);
  if (error) throw new Error(error.message);
}

/** Replace a poll's options wholesale (delete-then-insert) — options are a
 *  small ordered set edited as one array in the panel, so a full replace is
 *  simpler than diffing and keeps `position` contiguous. Cascades from the
 *  poll delete handle the FK. */
export async function replaceOptions(
  supabase: SupabaseClient,
  pollId: string,
  labels: string[]
): Promise<WebinarPollOptionRow[]> {
  const { error: delErr } = await supabase
    .from(WEBINAR_POLL_OPTIONS_TABLE)
    .delete()
    .eq("poll_id", pollId);
  if (delErr) throw new Error(delErr.message);

  const clean = labels.map((l) => l.trim()).filter(Boolean);
  if (clean.length === 0) return [];

  const { data, error } = await supabase
    .from(WEBINAR_POLL_OPTIONS_TABLE)
    .insert(clean.map((label, position) => ({ poll_id: pollId, label, position })))
    .select("*")
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as WebinarPollOptionRow[]) ?? [];
}
