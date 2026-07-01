import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { FeedCard, type FeedArticle, type FeedEntity } from "./feed-card";
import type { ArticleStat, CurrentUser, ReactionKind } from "./feed-actions";

export const metadata = { title: "Feed — Green Mentor Pro" };

// Broad tags shown in the feed filter bar (order = display order).
// Everything else (companies, long-tail entities) is filterable via the
// tags on each article card, just not surfaced here.
const FEATURED_SLUGS = ["csrd", "issb", "brsr", "ghg-protocol", "scope-3", "materiality"] as const;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  const { entity: activeSlug } = await searchParams;
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    { data: entities },
    { data: articles },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("entities").select("slug, name, kind").order("kind"),
    supabase
      .from("articles")
      .select("id, source, title, url, summary, image_url, published_at, article_entities(entities(slug, name, kind))")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(50),
  ]);

  const rows = (articles ?? []) as unknown as FeedArticle[];
  const ids = rows.map((a) => a.id);

  // Social layer. The two views come from 0004_feed_social.sql; if that
  // migration hasn't been applied yet these queries just error out and we fall
  // back to zeroed counts, so the feed still renders.
  const [{ data: stats }, { data: myReactions }, { data: profile }] = await Promise.all([
    ids.length
      ? supabase.from("article_social_stats").select("article_id, like_count, dislike_count, comment_count").in("article_id", ids)
      : Promise.resolve({ data: [] as (ArticleStat & { article_id: string })[] }),
    user && ids.length
      ? supabase.from("reactions").select("article_id, kind").eq("user_id", user.id).in("article_id", ids)
      : Promise.resolve({ data: [] as { article_id: string; kind: ReactionKind }[] }),
    user ? supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const statsBy = new Map((stats ?? []).map((s) => [s.article_id, s as ArticleStat] as const));
  const reactionBy = new Map((myReactions ?? []).map((r) => [r.article_id, r.kind as ReactionKind] as const));
  const currentUser: CurrentUser | null = user
    ? {
        id: user.id,
        name: profile?.display_name ?? user.email?.split("@")[0] ?? "You",
        avatar: profile?.avatar_url ?? null,
      }
    : null;

  const filtered = activeSlug
    ? rows.filter((a) => (a.article_entities ?? []).some((ae) => ae.entities?.slug === activeSlug))
    : rows;

  const bySlug = new Map((entities ?? []).map((e) => [e.slug, e] as const));
  const featured = FEATURED_SLUGS.map((s) => bySlug.get(s)).filter((e): e is FeedEntity => !!e);
  // Keep the active filter visible even if the user arrived via a card tag
  // (e.g. a company) that isn't in the curated list.
  const chipEntities =
    activeSlug && !FEATURED_SLUGS.includes(activeSlug as (typeof FEATURED_SLUGS)[number]) && bySlug.get(activeSlug)
      ? [...featured, bySlug.get(activeSlug)!]
      : featured;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* follow-graph filter chips */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/feed"
          className={
            "rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold " +
            (!activeSlug ? "border-teal-900 bg-teal-900 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300")
          }
        >
          All
        </Link>
        {chipEntities.map((e) => (
          <Link
            key={e.slug}
            href={`/feed?entity=${e.slug}`}
            className={
              "rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold " +
              (activeSlug === e.slug ? "border-teal-900 bg-teal-900 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300")
            }
          >
            {e.name}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-6 text-center text-[13.5px] text-gray-600">
          No articles yet. Run the ingestion worker (<code className="rounded bg-gray-100 px-1.5 py-0.5 text-[12px]">scripts/ingest-feed.ts</code>)
          or apply the 0003_feed.sql seed.
        </Card>
      ) : (
        <div className="h-[calc(100dvh-13rem)] snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] lg:h-[calc(100dvh-9rem)] [&::-webkit-scrollbar]:hidden">
          {filtered.map((a) => (
            <div key={a.id} className="h-full snap-start snap-always pb-3">
              <FeedCard
                article={a}
                fill
                stats={statsBy.get(a.id)}
                reaction={reactionBy.get(a.id) ?? null}
                currentUser={currentUser}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
