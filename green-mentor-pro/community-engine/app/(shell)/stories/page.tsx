import { PageHeader } from "@/components/ui";
import { StoriesPanel } from "@/components/stories/stories-panel";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { listStories, type StoryRow } from "@/lib/db/stories";

export const metadata = { title: "Stories — GreenMentor Community" };
export const dynamic = "force-dynamic";

export default async function StoriesPage() {
  await requireAdmin();

  const configured = isServiceRoleConfigured();
  const stories: StoryRow[] = configured ? await listStories(createAdminClient()) : [];

  return (
    <div>
      <PageHeader
        title="Stories"
        sub="The individual content pieces — drafts, reviews and publishing state for each story."
      />
      <StoriesPanel initialStories={stories} configured={configured} />
    </div>
  );
}
