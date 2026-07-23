import Link from "next/link";
import { ArrowRight, Newspaper } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui";

export type FeedPreviewArticle = {
  id: string;
  source: string;
  title: string;
  url: string;
  image_url: string | null;
  published_at: string | null;
};

function ago(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1d ago" : `${days}d ago`;
}

/** Compact "from the feed" preview on Home. Rows open the article (external),
 * like FeedCard; the header link goes to the full news feed. */
export function FeedPreview({ articles }: { articles: FeedPreviewArticle[] }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">
          <Newspaper size={16} /> From the feed
        </h2>
        <Link href="/feed" className="text-[12px] font-semibold text-green-700 hover:underline">
          Open feed <ArrowRight size={11} className="inline" />
        </Link>
      </div>

      {articles.length === 0 ? (
        <p className="mt-4 text-[12.5px] text-gray-500">No news yet — check back soon.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {articles.map((article) => (
            <li key={article.id}>
              <a
                href={article.url}
                target="_blank"
                rel="noreferrer"
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-gray-50"
              >
                {article.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={article.image_url}
                    alt=""
                    className="size-14 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-teal-900 via-teal-800 to-green-700 text-green-100/80">
                    <Newspaper size={20} />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink">
                    {article.title}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-gray-500">
                    {[article.source, ago(article.published_at)].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
