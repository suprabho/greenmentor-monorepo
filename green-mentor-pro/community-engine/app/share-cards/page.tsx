import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { ShareCardStudio } from "./studio";

export const metadata = { title: "Share cards studio — GreenMentor Community" };

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
      <ShareCardStudio initialId={id ?? null} />
    </div>
  );
}
