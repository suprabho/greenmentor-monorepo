import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * community_instructors — the roster CMS (migration 0008), mirroring the
 * platform `Mentor` shape. Public read policy, so any client can list them;
 * writes go through the service-role client behind requireAdmin(). Webinars
 * reference instructors by id (community_webinars.instructor_ids).
 */
export const INSTRUCTORS_TABLE = "community_instructors";

export interface InstructorRow {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  location: string | null;
  education: string | null;
  initials: string;
  photo: string | null;
  tags: string[];
  linkedin_url: string | null;
  created_at: string;
  updated_at: string;
}

/** Trimmed shape used where only display fields are needed (webinar cards, picker). */
export interface InstructorLite {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  photo: string | null;
  initials: string;
}

export const INSTRUCTOR_LITE_COLUMNS = "id, name, role, company, photo, initials";

export type InstructorEditableFields = Partial<
  Pick<
    InstructorRow,
    "name" | "role" | "company" | "location" | "education" | "initials" | "photo" | "tags" | "linkedin_url"
  >
>;

/** Derive 2-letter initials from a name, e.g. "Vishal Pandhare" → "VP". */
export function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

export async function listInstructors(supabase: SupabaseClient): Promise<InstructorRow[]> {
  const { data, error } = await supabase.from(INSTRUCTORS_TABLE).select("*").order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as InstructorRow[]) ?? [];
}

/** Resolve a set of ids to their display fields, keyed by id (for webinar cards). */
export async function listInstructorsByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Record<string, InstructorLite>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {};
  const { data, error } = await supabase
    .from(INSTRUCTORS_TABLE)
    .select(INSTRUCTOR_LITE_COLUMNS)
    .in("id", unique);
  if (error) throw new Error(error.message);
  const map: Record<string, InstructorLite> = {};
  for (const row of (data ?? []) as InstructorLite[]) map[row.id] = row;
  return map;
}

export async function insertInstructor(
  supabase: SupabaseClient,
  input: InstructorEditableFields & { name: string }
): Promise<InstructorRow> {
  const { data, error } = await supabase.from(INSTRUCTORS_TABLE).insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data as InstructorRow;
}

export async function updateInstructor(
  supabase: SupabaseClient,
  id: string,
  input: InstructorEditableFields
): Promise<void> {
  const { error } = await supabase.from(INSTRUCTORS_TABLE).update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteInstructor(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from(INSTRUCTORS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
