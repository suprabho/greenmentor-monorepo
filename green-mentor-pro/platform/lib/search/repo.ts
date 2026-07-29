import { createClient } from "@/lib/supabase/server";
import { anyColumnMatches, rankAndCap, sanitizeQuery, scoreHit } from "./rank";
import type { SearchHit, SearchResults } from "./rank";

// Global search for the ⌘K palette. Every read goes through the RLS-bound
// server client (the signed-in learner's own session), which means Postgres
// does the permission scoping for us: signed out, `courses`/`lessons` return
// nothing while `articles` still resolve. There is deliberately no manual
// auth check here — see app/api/search/route.ts.
//
// Matching is `ilike` fan-out, not full-text search. That is a conscious
// ceiling: no stemming ("reporting" won't match "report"), no typo tolerance,
// no term-frequency ranking. Two things are also deliberately not searched:
//
//   • lessons.transcript — the largest text column in the app; an ilike on it
//     would seq-scan the table on every keystroke.
//   • jobs_public.tags / lessons.key_topics — text[], and PostgREST offers
//     only `cs` (exact element containment) for arrays, not ilike.
//
// Both become cheap if this moves to tsvector + GIN indexes, which is the
// natural upgrade once content volume justifies a migration.

export type { SearchHit, SearchKind, SearchResults } from "./rank";

/** Rows-per-kind fetched from Postgres before scoring. Wider than what we
 *  return so ranking has something to choose from. */
const FETCH_LIMIT = 12;

/** PostgREST types to-one embeds as possibly-array; normalise before reading. */
function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function searchAll(raw: string, perKind = 5): Promise<SearchResults> {
  const q = sanitizeQuery(raw);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const limitedBySignIn = !user;

  if (!q) return { hits: [], limitedBySignIn };

  // One round trip per kind, all in flight together. Errors are read off each
  // result rather than thrown: a single missing view (say jobs_public before
  // its migration lands) degrades that group to empty instead of taking the
  // whole palette down.
  const [courses, lessons, jobs, webinars, articles] = await Promise.all([
    supabase
      .from("courses")
      .select("id, slug, title, description")
      .eq("status", "published")
      .or(anyColumnMatches(["title", "description"], q))
      .limit(FETCH_LIMIT),
    supabase
      .from("lessons")
      .select("id, title, objective, modules(title, courses(slug, title))")
      .or(anyColumnMatches(["title", "objective"], q))
      .limit(FETCH_LIMIT),
    supabase
      .from("jobs_public")
      .select("id, title, company, location, details")
      .or(anyColumnMatches(["title", "company", "location", "details"], q))
      .limit(FETCH_LIMIT),
    supabase
      .from("webinars_public")
      .select("id, title, hook")
      .or(anyColumnMatches(["title", "hook"], q))
      .limit(FETCH_LIMIT),
    supabase
      .from("articles")
      .select("id, title, summary, source, url")
      .or(anyColumnMatches(["title", "summary", "source"], q))
      .limit(FETCH_LIMIT),
  ]);

  const hits: SearchHit[] = [];

  for (const row of courses.data ?? []) {
    hits.push({
      kind: "course",
      id: row.id,
      title: row.title,
      subtitle: row.description,
      href: `/academy/${row.slug}`,
      score: scoreHit(row.title, q, [row.description]),
    });
  }

  // A lesson's href needs the owning course's slug, which is only reachable
  // through its module — hence the two-level embed.
  type LessonRow = {
    id: string;
    title: string;
    objective: string | null;
    modules: { title: string; courses: { slug: string; title: string } | null } | null;
  };
  for (const row of (lessons.data ?? []) as unknown as LessonRow[]) {
    const mod = one(row.modules);
    const course = mod ? one(mod.courses) : null;
    if (!course?.slug || !mod) continue; // orphaned lesson — nowhere to send anyone
    hits.push({
      kind: "lesson",
      id: row.id,
      title: row.title,
      subtitle: `${course.title} › ${mod.title}`,
      href: `/academy/${course.slug}/lesson/${row.id}`,
      score: scoreHit(row.title, q, [row.objective]),
    });
  }

  for (const row of jobs.data ?? []) {
    hits.push({
      kind: "job",
      id: row.id,
      title: row.title,
      subtitle: [row.company, row.location].filter(Boolean).join(" · ") || null,
      href: "/jobs",
      score: scoreHit(row.title, q, [row.company, row.location, row.details]),
    });
  }

  for (const row of webinars.data ?? []) {
    hits.push({
      kind: "webinar",
      id: row.id,
      title: row.title,
      subtitle: row.hook,
      href: "/webinars",
      score: scoreHit(row.title, q, [row.hook]),
    });
  }

  for (const row of articles.data ?? []) {
    hits.push({
      kind: "article",
      id: row.id,
      title: row.title,
      subtitle: row.source,
      href: row.url,
      external: true,
      score: scoreHit(row.title, q, [row.summary, row.source]),
    });
  }

  return { hits: rankAndCap(hits, perKind), limitedBySignIn };
}
