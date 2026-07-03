import { requireAdmin } from "@/lib/auth/admin";
import { ShareCardStudio } from "./studio";

export const metadata = { title: "Share cards studio — GreenMentor Community" };

/** A full-screen surface: no page header, no shell padding — the studio owns
 *  everything below the site header. */
export default async function ShareCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  await requireAdmin();
  const { id } = await searchParams;

  return <ShareCardStudio initialId={id ?? null} />;
}
