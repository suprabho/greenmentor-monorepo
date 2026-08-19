import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { deleteStorySource, getStorySource } from "@/lib/db/story-sources";
import { getStory, updateStory } from "@/lib/db/stories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  const { id, sourceId } = await params;

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });

  const client = createAdminClient();
  // Read before delete: removing an attached recap must also clear the recap
  // pointers in compose_state, or the Angles stage would keep offering a topic
  // picker for a source that no longer exists.
  const source = await getStorySource(client, id, sourceId);
  await deleteStorySource(client, id, sourceId);

  if (source?.kind === "recap") {
    const story = await getStory(client, id);
    if (story) {
      await updateStory(client, id, {
        compose_state: {
          ...story.compose_state,
          recapId: null,
          recapTopicId: null,
          recapTopic: null,
        },
      });
    }
  }
  return NextResponse.json({ ok: true });
}
