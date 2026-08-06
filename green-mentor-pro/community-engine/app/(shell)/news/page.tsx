import { PageHeader } from "@/components/ui";
import { NewsPanel } from "@/components/news/news-panel";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { listNews, type NewsRow } from "@/lib/db/news";

export const metadata = { title: "News — GreenMentor Community" };
export const dynamic = "force-dynamic";

export default async function NewsPage() {
  await requireAdmin();

  const configured = isServiceRoleConfigured();
  let articles: NewsRow[] = [];
  if (configured) articles = await listNews(createAdminClient());

  return (
    <div>
      <PageHeader
        title="News"
        sub="The ESG feed the platform shows. The nightly RSS worker owns the copy; the one thing you can set by hand is the picture — for regulators and wire copy that publish none, which otherwise render as a bare gradient."
      />
      <NewsPanel initialArticles={articles} configured={configured} />
    </div>
  );
}
