import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui";
import { shareCardHref } from "@/lib/share/href";
import { isUuid } from "@/lib/share/slug";
import { cardAspect, fetchCardSocial, fetchShareCard } from "@/lib/share-cards/repo";
import { shareMetadata } from "@/lib/share/og";
import { createClient } from "@/lib/supabase/server";
import { FeedItemActions, type CurrentUser } from "../../feed-actions";

// Shareable permalink for a published community share card — what the card's
// Share button spreads, the card twin of /feed/[slug]. Addressed by the full
// studio card uuid (stable across republishes; publications mint no slug), so
// there's no pretty-slug redirect dance here.
//
// Public: share_cards_public, card_social_stats and card_feed_comments are all
// definer views granted to anon, so the whole page renders signed-out.
export const dynamic = "force-dynamic";

function fmtWhen(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export async function generateMetadata({ params }: { params: Promise<{ cardId: string }> }): Promise<Metadata> {
  const { cardId } = await params;
  if (!isUuid(cardId)) return { title: "Card not found — Green Mentor Pro" };
  const card = await fetchShareCard(cardId).catch(() => null);
  if (!card) return { title: "Card not found — Green Mentor Pro" };

  return shareMetadata({
    title: card.title,
    description: card.caption,
    path: shareCardHref(card),
    image: card.imageUrl,
    badge: "GreenMentor",
    subtitle: "GreenMentor",
    type: "article",
    publishedTime: card.publishedAt,
  });
}

export default async function ShareCardPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  if (!isUuid(cardId)) notFound();
  const card = await fetchShareCard(cardId).catch(() => null);
  if (!card) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [social, { data: profile }] = await Promise.all([
    fetchCardSocial(card.cardId, user?.id ?? null),
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

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/feed"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gray-500 transition-colors hover:text-gray-800"
      >
        <ArrowLeft size={14} weight="bold" /> Back to news
      </Link>

      <Card className="overflow-hidden">
        <a href={card.imageUrl} target="_blank" rel="noopener noreferrer" title="Open full-size" className="block bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase-storage URL; next/image needs an allow-listed loader domain */}
          <img
            src={card.imageUrl}
            alt={card.title}
            className="mx-auto w-full object-contain"
            style={{ aspectRatio: cardAspect(card.ratio) }}
          />
        </a>

        <div className="p-6">
          <div className="flex items-center gap-2 text-[12px] text-gray-500">
            <span className="rounded-pill bg-teal-900 px-2 py-0.5 font-semibold text-green-100">GreenMentor</span>
            <span>{fmtWhen(card.publishedAt)}</span>
          </div>

          <h1 className="mt-3 text-[22px] font-semibold leading-snug tracking-tight text-ink">{card.title}</h1>

          {card.caption && <p className="mt-3 text-[14px] leading-relaxed text-gray-700">{card.caption}</p>}

          <div className="mt-5">
            <FeedItemActions
              subject={{ kind: "card", id: card.cardId }}
              title={card.title}
              sharePath={shareCardHref(card)}
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
