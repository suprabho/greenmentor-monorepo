import { unstable_rethrow } from "next/navigation";
import { getEngagementContext } from "@/lib/engagement-session";
import { listConversations } from "@/lib/chat/repo";
import { WorkspaceFrame } from "@/components/ai-hub/WorkspaceFrame";
import { WorkspaceTopToggle } from "@/components/ai-hub/WorkspaceTopToggle";

/**
 * Claude-style AI Hub workspace shell. Nested under the app Shell, it takes over
 * the viewport (WorkspaceFrame) and keeps the Chat · Cowork · Artifacts toggle
 * mounted across all three surfaces. The conversation list is fetched here (not
 * only in chat/layout) so the toolbar's sub-lg history drawer has it on every
 * surface; React cache() dedupes the double fetch on chat routes.
 */
export default async function AiHubLayout({ children }: { children: React.ReactNode }) {
  // The history drawer is non-critical chrome. If auth or the DB hiccups, degrade
  // to an empty list rather than throwing — an unguarded throw here has no error
  // boundary above it, so it collapses the whole workspace to Next's
  // _global-error 500 page (same rationale as chat/layout.tsx).
  let conversations: Awaited<ReturnType<typeof listConversations>> = [];
  try {
    const ctx = await getEngagementContext();
    if (ctx) conversations = await listConversations(ctx.orgId, ctx.userId);
  } catch (e) {
    unstable_rethrow(e);
    console.error("AiHubLayout: failed to load chat history", e);
  }

  return (
    <WorkspaceFrame toolbar={<WorkspaceTopToggle conversations={conversations} />}>
      {children}
    </WorkspaceFrame>
  );
}
