import { parseShareParam, pickCanonical, shareSlug } from "@/lib/share/slug";
import { createClient } from "@/lib/supabase/server";

// Jobs are authored in the community-engine admin hub (community_jobs, RLS with
// no policies) and published to learners through the jobs_public view, which
// exposes only the safe columns of published rows — never the admin-only notes.
// All reads here go through the RLS-bound server client, like lib/webinars/repo.ts.

export type JobSeniority = "entry" | "mid" | "senior" | "lead";

export interface Job {
  id: string;
  /** Canonical URL segment, `{slug}-{idPrefix}`. Use jobHref() to build a path. */
  shareSlug: string;
  title: string;
  company: string | null;
  location: string | null;
  country: string | null;
  employmentType: string;
  experience: string | null;
  seniority: JobSeniority | null;
  details: string | null;
  tags: string[];
  applyUrl: string | null;
  applyEmail: string | null;
  salary: string | null;
  applicationDeadline: string | null;
  preferred: string | null;
  postedOn: string | null;
}

const JOB_COLUMNS =
  "id, slug, id_prefix, title, company, location, country, employment_type, experience, seniority, details, tags, apply_url, apply_email, salary, application_deadline, preferred, posted_on";

interface JobRowRaw {
  id: string;
  slug: string | null;
  id_prefix: string | null;
  title: string;
  company: string | null;
  location: string | null;
  country: string | null;
  employment_type: string;
  experience: string | null;
  seniority: string | null;
  details: string | null;
  tags: string[] | null;
  apply_url: string | null;
  apply_email: string | null;
  salary: string | null;
  application_deadline: string | null;
  preferred: string | null;
  posted_on: string | null;
}

function mapJob(row: JobRowRaw): Job {
  return {
    id: row.id,
    shareSlug: shareSlug(row.slug, row.id),
    title: row.title,
    company: row.company,
    location: row.location,
    country: row.country,
    employmentType: row.employment_type,
    experience: row.experience,
    seniority: (row.seniority as JobSeniority) ?? null,
    details: row.details,
    tags: row.tags ?? [],
    applyUrl: row.apply_url,
    applyEmail: row.apply_email,
    salary: row.salary,
    applicationDeadline: row.application_deadline,
    preferred: row.preferred,
    postedOn: row.posted_on,
  };
}

/** Every published job, newest digest first. */
export async function fetchJobs(): Promise<Job[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs_public")
    .select(JOB_COLUMNS)
    .order("posted_on", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as JobRowRaw[]).map(mapJob);
}

/** A single published job, by raw uuid. */
export async function fetchJobById(id: string): Promise<Job | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("jobs_public").select(JOB_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapJob(data as JobRowRaw) : null;
}

/**
 * Resolve a `[slug]` route param — either a share slug or a bare uuid. See
 * resolveWebinar() in lib/webinars/repo.ts for the canonical-redirect contract.
 */
export async function resolveJob(param: string): Promise<Job | null> {
  const parsed = parseShareParam(param);
  if (!parsed) return null;
  if (parsed.kind === "uuid") return fetchJobById(parsed.id);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs_public")
    .select(JOB_COLUMNS)
    .eq("id_prefix", parsed.idPrefix)
    .limit(2);
  if (error) throw new Error(error.message);
  const row = pickCanonical((data ?? []) as JobRowRaw[], parsed.slug);
  return row ? mapJob(row) : null;
}
