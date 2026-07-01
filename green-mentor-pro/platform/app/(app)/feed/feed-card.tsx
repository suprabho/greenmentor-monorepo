import Link from "next/link";
import { clsx } from "clsx";
import { Card, Chip } from "@/components/ui";
import { ArticleActions, type ArticleStat, type CurrentUser, type ReactionKind } from "./feed-actions";

export type FeedEntity = { slug: string; name: string; kind: string };
export type FeedArticle = {
  id: string;
  source: string;
  title: string;
  url: string;
  summary: string | null;
  image_url: string | null;
  published_at: string | null;
  article_entities: { entities: FeedEntity | null }[] | null;
};

const KIND_TONE: Record<string, "green" | "teal" | "neutral" | "warn"> = {
  framework: "teal",
  topic: "green",
  region: "warn",
  company: "neutral",
};

// How many tag chips to surface before collapsing the rest into "+N more".
const MAX_CHIPS = 3;

function ago(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

/** Hero thumbnail with a branded gradient fallback for image-less articles. */
function Thumbnail({ src, source, className }: { src: string | null; source: string; className: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote hosts; next/image needs allow-listed domains
      <img src={src} alt="" draggable={false} className={clsx("w-full bg-gray-100 object-cover", className)} />
    );
  }
  return (
    <div
      className={clsx(
        "flex w-full items-center justify-center bg-gradient-to-br from-teal-900 via-teal-800 to-green-700",
        className,
      )}
    >
      <span className="px-6 text-center text-[15px] font-semibold tracking-wide text-green-100">{source}</span>
    </div>
  );
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
        <Thumbnail src={article.image_url} source={article.source} className={fill ? "h-full" : "aspect-[16/9]"} />
      </a>

      <div className={clsx("flex flex-col gap-2.5 p-5", fill && "min-h-0 flex-1")}>
        <div className="flex items-center gap-2 text-[12px] text-gray-500">
          <span className="rounded-pill bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">{article.source}</span>
          <span>{ago(article.published_at)}</span>
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
            url={article.url}
            stats={stats}
            initialReaction={reaction}
            currentUser={currentUser}
          />
        </div>
      </div>
    </Card>
  );
}
