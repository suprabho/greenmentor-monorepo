import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { listMine, listSharedByOthers } from "@/lib/db/headers";
import { listMineCards, listPublishedCardIds, listSharedCardsByOthers } from "@/lib/db/shareCards";
import { LibraryView } from "./library-view";
import { ShareCardsLibraryView } from "./share-cards-view";

export const metadata = { title: "Library — GreenMentor Community" };

type LibraryTab = "headers" | "cards";

function TabLink({ tab, active, label }: { tab: LibraryTab; active: boolean; label: string }) {
  return (
    <Link
      href={tab === "headers" ? "/library" : `/library?tab=${tab}`}
      className={`rounded-pill px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
        active ? "bg-teal-900 text-white" : "bg-white text-gray-700 border border-gray-200"
      }`}
    >
      {label}
    </Link>
  );
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/library");

  const { tab: tabParam } = await searchParams;
  const tab: LibraryTab = tabParam === "cards" ? "cards" : "headers";

  const [mine, shared, mineCards, sharedCards] = await Promise.all([
    listMine(supabase, user.id),
    listSharedByOthers(supabase, user.id),
    // The share-cards table may not be migrated yet — treat that as empty
    // rather than breaking the headers library.
    listMineCards(supabase, user.id).catch(() => []),
    listSharedCardsByOthers(supabase, user.id).catch(() => []),
  ]);

  // Which cards are live on the platform library — same tolerance as above:
  // a missing share_cards_public view (migration 0019 not applied yet) just
  // reads as "nothing published".
  const publishedIds = await listPublishedCardIds(supabase, [
    ...mineCards.map((c) => c.id),
    ...sharedCards.map((c) => c.id),
  ]).catch(() => new Set<string>());

  return (
    <div>
      <PageHeader
        title="Library"
        sub="Your personal library and everything shared with the GreenMentor team — headers and share cards."
      />
      <div className="mb-6 flex gap-2">
        <TabLink tab="headers" active={tab === "headers"} label={`Headers (${mine.length + shared.length})`} />
        <TabLink tab="cards" active={tab === "cards"} label={`Share cards (${mineCards.length + sharedCards.length})`} />
      </div>
      {tab === "headers" ? (
        <LibraryView mine={mine} shared={shared} userId={user.id} />
      ) : (
        <ShareCardsLibraryView mine={mineCards} shared={sharedCards} published={[...publishedIds]} />
      )}
    </div>
  );
}
