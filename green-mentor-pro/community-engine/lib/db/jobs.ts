import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * community_jobs — the ESG & sustainability jobs board CMS (migration 0011).
 * Curated openings authored in the admin hub and published to the learner
 * platform's /jobs board.
 *
 * Like community_webinars this is admin-hub data: RLS is enabled with no
 * policies, so every call here must go through the service-role client
 * (lib/supabase/admin.ts) behind requireAdmin(). Learners read published rows
 * through the `jobs_public` view, which drops the admin-only `notes` column.
 */
export const JOBS_TABLE = "community_jobs";

export type JobStatus = "draft" | "published" | "archived";
export type JobSeniority = "entry" | "mid" | "senior" | "lead";

export interface JobRow {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  country: string | null;
  employment_type: string;
  experience: string | null;
  seniority: JobSeniority | null;
  details: string | null;
  tags: string[];
  apply_url: string | null;
  apply_email: string | null;
  salary: string | null;
  application_deadline: string | null;
  preferred: string | null;
  posted_on: string | null;
  notes: string | null;
  status: JobStatus;
  created_at: string;
  updated_at: string;
}

export type JobEditableFields = Partial<
  Pick<
    JobRow,
    | "title"
    | "company"
    | "location"
    | "country"
    | "employment_type"
    | "experience"
    | "seniority"
    | "details"
    | "tags"
    | "apply_url"
    | "apply_email"
    | "salary"
    | "application_deadline"
    | "preferred"
    | "posted_on"
    | "notes"
    | "status"
  >
>;

export async function listJobs(supabase: SupabaseClient): Promise<JobRow[]> {
  const { data, error } = await supabase
    .from(JOBS_TABLE)
    .select("*")
    .order("posted_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as JobRow[]) ?? [];
}

export async function getJob(supabase: SupabaseClient, id: string): Promise<JobRow | null> {
  const { data, error } = await supabase.from(JOBS_TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as JobRow) ?? null;
}

export async function insertJob(
  supabase: SupabaseClient,
  input: JobEditableFields & { title: string }
): Promise<JobRow> {
  const { data, error } = await supabase.from(JOBS_TABLE).insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data as JobRow;
}

export async function updateJob(
  supabase: SupabaseClient,
  id: string,
  input: JobEditableFields
): Promise<void> {
  const { error } = await supabase.from(JOBS_TABLE).update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteJob(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from(JOBS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
