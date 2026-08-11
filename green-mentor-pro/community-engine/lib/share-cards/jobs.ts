import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShareCardJob } from "./types";

/** The jobs_public columns a card renders. The view (0011 + 0017) exposes only
 *  published rows and is granted to anon + authenticated — the base
 *  community_jobs table has RLS with no policies, so the session-bound clients
 *  this pipeline threads (studio data route, export, publish) would read zero
 *  rows from it. Consequence: only PUBLISHED jobs are pickable/renderable. */
const JOB_SELECT =
  "id, title, company, location, employment_type, experience, seniority, details, tags, salary, application_deadline, posted_on";

type JobPublicRow = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  employment_type: string;
  experience: string | null;
  seniority: string | null;
  details: string | null;
  tags: string[] | null;
  salary: string | null;
  application_deadline: string | null;
  posted_on: string | null;
};

function toShareCardJob(row: JobPublicRow): ShareCardJob {
  return { ...row, tags: row.tags ?? [] };
}

/**
 * Published jobs in the shape the card modules consume. `ids` scopes the query
 * to specific jobs (the export route resolving a snapshot's picks); otherwise
 * returns the newest `limit` (the studio's picker list). No entity decoding —
 * jobs are hand-authored in the admin CMS, not RSS-scraped. jobs_public has no
 * created_at, so ordering mirrors the platform board (posted_on desc, title).
 */
export async function fetchShareCardJobs(
  supabase: SupabaseClient,
  opts: { ids?: string[]; limit?: number } = {}
): Promise<ShareCardJob[]> {
  let query = supabase.from("jobs_public").select(JOB_SELECT);
  if (opts.ids && opts.ids.length > 0) {
    query = query.in("id", opts.ids);
  } else {
    query = query
      .order("posted_on", { ascending: false, nullsFirst: false })
      .order("title", { ascending: true })
      .limit(opts.limit ?? 60);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as JobPublicRow[]).map(toShareCardJob);
}
