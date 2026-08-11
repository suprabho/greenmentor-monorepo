import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/ui";
import { cardAspect, fetchShareCards, type ShareCard } from "@/lib/share-cards/repo";

export const metadata = { title: "Library — Green Mentor Pro" };
export const dynamic = "force-dynamic";

function fmtDate(value: string) {
  try {
    return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function ShareCardTile({ card }: { card: ShareCard }) {
  return (
    <a
      href={card.imageUrl}
      target="_blank"
      rel="noreferrer"
      title="Open full-size"
      className="group mb-4 block break-inside-avoid overflow-hidden rounded-[10px] border border-gray-200 bg-white shadow-soft"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Supabase-storage URL; next/image needs an allow-listed loader domain */}
      <img
        src={card.imageUrl}
        alt={card.title}
        loading="lazy"
        className="w-full bg-gray-100 object-cover"
        style={{ aspectRatio: cardAspect(card.ratio) }}
      />
      <div className="px-4 py-3">
        <div className="truncate text-[13.5px] font-semibold text-ink group-hover:text-green-700">
          {card.title}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-gray-500">
          {card.caption ?? fmtDate(card.publishedAt)}
        </div>
      </div>
    </a>
  );
}

export default async function LibraryPage() {
  // Tolerant of the share_cards_public view not being migrated yet
  // (community-engine migration 0019) — reads as "nothing published".
  const cards = await fetchShareCards().catch(() => []);

  // Until the community team publishes the first card, the library keeps its
  // roadmap stub — same navigable route, nothing broken.
  if (cards.length === 0) {
    return <ComingSoon title="Content Library" sub="Curated ESG references & templates" />;
  }

  return (
    <div>
      <PageHeader
        title="Content Library"
        sub="Shareable ESG explainers and stat cards from the GreenMentor community team — open one full-size to save or repost."
      />
      {/* CSS-columns masonry: the cards ship in four aspect ratios, and
          column flow packs the mix tighter than a uniform grid. */}
      <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
        {cards.map((card) => (
          <ShareCardTile key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
