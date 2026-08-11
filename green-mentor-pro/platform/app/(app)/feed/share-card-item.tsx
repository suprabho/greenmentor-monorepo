import { clsx } from "clsx";
import { Card } from "@/components/ui";
import { cardAspect, type ShareCard } from "@/lib/share-cards/repo";
import { ago } from "./feed-card";

/**
 * A community share card as a feed item, interleaved with FeedCards in the
 * snap-scroll. The rendered PNG is the content, so it gets the card's body
 * (object-contain — the studio ships four aspect ratios and the feed pane is
 * one fixed box); a slim footer carries the byline + title. Clicking the
 * image opens it full-size to save or repost.
 *
 * `fill` matches FeedCard's contract: stretch to the container's height with
 * a pinned footer, for the swipable stack.
 */
export function ShareCardFeedItem({ card, fill = false }: { card: ShareCard; fill?: boolean }) {
  return (
    <Card className={clsx("overflow-hidden", fill && "flex h-full flex-col")}>
      <a
        href={card.imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Open full-size"
        className={clsx("block bg-gray-50", fill && "min-h-0 flex-1")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Supabase-storage URL; next/image needs an allow-listed loader domain */}
        <img
          src={card.imageUrl}
          alt={card.title}
          loading="lazy"
          className={clsx("mx-auto", fill ? "h-full w-full object-contain" : "w-full")}
          style={fill ? undefined : { aspectRatio: cardAspect(card.ratio) }}
        />
      </a>

      <div className="flex shrink-0 flex-col gap-1.5 p-5">
        <div className="flex items-center gap-2 text-[12px] text-gray-500">
          <span className="rounded-pill bg-teal-900 px-2 py-0.5 font-semibold text-green-100">
            GreenMentor
          </span>
          <span>{ago(card.publishedAt)}</span>
        </div>
        <h2 className={clsx("text-[16px] font-semibold leading-snug text-ink", fill && "line-clamp-1")}>
          {card.title}
        </h2>
        {card.caption && (
          <p className={clsx("text-[13.5px] leading-relaxed text-gray-700", fill && "line-clamp-2")}>
            {card.caption}
          </p>
        )}
      </div>
    </Card>
  );
}
