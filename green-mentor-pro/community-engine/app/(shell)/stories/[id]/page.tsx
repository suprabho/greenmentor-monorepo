import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { StoryEditPanel } from "@/components/stories/story-edit-panel";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { getStory } from "@/lib/db/stories";
import { listStorySources } from "@/lib/db/story-sources";

export const metadata = { title: "Edit story — GreenMentor Community" };
export const dynamic = "force-dynamic";

export default async function StoryEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  if (!isServiceRoleConfigured()) {
    return (
      <div>
        <PageHeader title="Edit story" sub="Editing needs SUPABASE_SERVICE_ROLE_KEY set server-side." />
      </div>
    );
  }

  const client = createAdminClient();
  const story = await getStory(client, id);
  if (!story) notFound();

  const sources = await listStorySources(client, id);

  return (
    <div>
      <PageHeader title="Edit story" sub={story.title} />
      <StoryEditPanel story={story} initialSources={sources} />
    </div>
  );
}
