import { PageHeader } from "@/components/ui";
import { AdminTabs, type AdminTab } from "@/components/admin-tabs";
import { requireAdmin } from "@/lib/auth/admin";
import { ADMIN_SECTIONS } from "@/lib/admin/sections";
import { ShareCardStudio } from "./studio";

export const metadata = { title: "Share cards studio — GreenMentor Community" };

/** Tab strip derived from the section registry — soon sections show muted. */
const tabs: AdminTab[] = ADMIN_SECTIONS.map((s) => ({
  href: s.href,
  label: s.name,
  exact: s.href === "/share-cards",
  soon: s.status === "soon",
}));

export default async function ShareCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  await requireAdmin();
  const { id } = await searchParams;

  return (
    <div>
      <PageHeader
        title="Share cards studio"
        sub="Compose on-brand social share cards from the news pipe — free-arrange layers over aura backgrounds, export pixel-perfect PNGs."
      />
      <div className="mb-6">
        <AdminTabs tabs={tabs} />
      </div>
      <ShareCardStudio initialId={id ?? null} />
    </div>
  );
}
