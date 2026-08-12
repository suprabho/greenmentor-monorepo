import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import { ArticleImage } from "@/components/feed/article-image";
import { articleHref } from "@/lib/share/href";
import { fetchArticleSocial, resolveArticle, type FeedEntity } from "@/lib/feed/repo";
import { shareMetadata } from "@/lib/share/og";
import { createClient } from "@/lib/supabase/server";
import { FeedItemActions, type CurrentUser } from "../feed-actions";

// Shareable permalink for a feed post. This is what the Share button now
// spreads — previously it handed out the publisher's URL, so sharing a Green
// Mentor discussion promoted ESG Today instead.
//
// Public: articles/entities/article_entities all carry a "public read" policy
// (migration 0003_feed.sql), and article_social_stats + feed_comments are
// definer views granted to anon, so the whole page renders signed-out.
export const dynamic = "force-dynamic";

const KIND_TONE: Record<string, "green" | "teal" | "neutral" | "warn"> = {
  framework: "teal",
  topic: "green",
  region: "warn",
  company: "neutral",
};

function fmtWhen(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await resolveArticle(slug);
  if (!article) return { title: "Article not found — Green Mentor Pro" };

  return shareMetadata({
    title: article.title,
    description: article.summary,
    path: articleHref(article),
    image: article.image_url,
    badge: article.source,
    subtitle: article.source,
    type: "article",
    publishedTime: article.published_at,
  });
}

export default async function FeedPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await resolveArticle(slug);
  if (!article) notFound();

  // Old links (a retitled article, or a bare uuid) still resolve — send them on
  // to the canonical URL so what people copy from the address bar is current.
  const href = articleHref(article);
  if (slug !== article.shareSlug) redirect(href);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [social, { data: profile }] = await Promise.all([
    fetchArticleSocial(article.id, user?.id ?? null),
    user
      ? supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const currentUser: CurrentUser | null = user
    ? {
        id: user.id,
        name: profile?.display_name ?? user.email?.split("@")[0] ?? "You",
        avatar: profile?.avatar_url ?? null,
      }
    : null;

  const entities = (article.article_entities ?? [])
    .map((ae) => ae.entities)
    .filter((e): e is FeedEntity => !!e);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/feed"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gray-500 transition-colors hover:text-gray-800"
      >
        <ArrowLeft size={14} weight="bold" /> Back to news
      </Link>

      <Card className="overflow-hidden">
        <ArticleImage src={article.image_url} source={article.source} className="aspect-[16/9] w-full" />

        <div className="p-6">
          <div className="flex items-center gap-2 text-[12px] text-gray-500">
            <span className="rounded-pill bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">{article.source}</span>
            <span>{fmtWhen(article.published_at)}</span>
          </div>

          <h1 className="mt-3 text-[22px] font-semibold leading-snug tracking-tight text-ink">{article.title}</h1>

          {article.summary && (
            <p className="mt-3 text-[14px] leading-relaxed text-gray-700">{article.summary}</p>
          )}

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 rounded-pill bg-teal-900 px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-teal-800"
          >
            Read the original <ArrowSquareOut size={14} />
          </a>

          {entities.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-1.5">
              {entities.map((entity) => (
                <Link key={entity.slug} href={`/feed?entity=${entity.slug}`}>
                  <Chip tone={KIND_TONE[entity.kind] ?? "neutral"}>{entity.name}</Chip>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-5">
            <FeedItemActions
              subject={{ kind: "article", id: article.id }}
              title={article.title}
              sharePath={href}
              stats={social.stats}
              initialReaction={social.reaction}
              currentUser={currentUser}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
