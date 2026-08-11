import Link from "next/link";
import { clsx } from "clsx";
import { Card, Chip } from "@/components/ui";
import { ArticleImage } from "@/components/feed/article-image";
import { articleHref } from "@/lib/share/href";
import type { FeedArticle, FeedEntity } from "@/lib/feed/repo";
import { ArticleActions, type ArticleStat, type CurrentUser, type ReactionKind } from "./feed-actions";

// The row types live in lib/feed/repo.ts alongside the query that produces
// them; re-exported here so existing `from "./feed-card"` imports keep working.
export type { FeedArticle, FeedEntity };

const KIND_TONE: Record<string, "green" | "teal" | "neutral" | "warn"> = {
  framework: "teal",
  topic: "green",
  region: "warn",
  company: "neutral",
};

// How many tag chips to surface before collapsing the rest into "+N more".
const MAX_CHIPS = 3;

/** Compact relative timestamp — shared with the share-card feed item. */
export function ago(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

/**
 * Feed article card. `fill` makes it stretch to its container's height with a
 * clamped summary and a pinned footer — used by the swipable FeedStack, where
 * every card must be the same size. Without it the card is content-height, for
 * a plain vertical list.
 */
export function FeedCard({
  article,
  fill = false,
  stats,
  reaction = null,
  currentUser = null,
}: {
  article: FeedArticle;
  fill?: boolean;
  stats?: ArticleStat;
  reaction?: ReactionKind | null;
  currentUser?: CurrentUser | null;
}) {
  const entities = (article.article_entities ?? [])
    .map((ae) => ae.entities)
    .filter((e): e is FeedEntity => !!e);
  const shown = entities.slice(0, MAX_CHIPS);
  const overflow = entities.length - shown.length;

  return (
    <Card className={clsx("overflow-hidden", fill && "flex h-full flex-col")}>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className={clsx("block", fill && "h-[44%] shrink-0")}
      >
        <ArticleImage
          src={article.image_url}
          source={article.source}
          className={fill ? "h-full w-full" : "aspect-[16/9] w-full"}
        />
      </a>

      <div className={clsx("flex flex-col gap-2.5 p-5", fill && "min-h-0 flex-1")}>
        <div className="flex items-center gap-2 text-[12px] text-gray-500">
          <span className="rounded-pill bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">{article.source}</span>
          {/* Timestamp-as-permalink, the usual social convention. The headline
              itself stays pointed at the publisher so the reading flow is unchanged. */}
          <Link href={articleHref(article)} className="hover:text-gray-700 hover:underline">
            {ago(article.published_at)}
          </Link>
        </div>

        <a href={article.url} target="_blank" rel="noopener noreferrer" className="block">
          <h2
            className={clsx(
              "text-[16px] font-semibold leading-snug text-ink hover:text-teal-700",
              fill && "line-clamp-2",
            )}
          >
            {article.title}
          </h2>
        </a>

        {article.summary && (
          <p className={clsx("text-[13.5px] leading-relaxed text-gray-700", fill && "line-clamp-2")}>
            {article.summary}
          </p>
        )}

        {/* In fill mode mt-auto pins the tags + action bar to the bottom of the card. */}
        <div className={clsx("flex flex-col gap-2.5", fill && "mt-auto")}>
          {entities.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {shown.map((e) => (
                <Link key={e.slug} href={`/feed?entity=${e.slug}`}>
                  <Chip tone={KIND_TONE[e.kind] ?? "neutral"}>{e.name}</Chip>
                </Link>
              ))}
              {overflow > 0 && <Chip tone="neutral">+{overflow} more</Chip>}
            </div>
          )}

          <ArticleActions
            articleId={article.id}
            title={article.title}
            sharePath={articleHref(article)}
            stats={stats}
            initialReaction={reaction}
            currentUser={currentUser}
          />
        </div>
      </div>
    </Card>
  );
}
