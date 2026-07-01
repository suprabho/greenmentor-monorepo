import { getEngagementContext } from "@/lib/engagement-session";
import { listConversations } from "@/lib/chat/repo";
import { RecentsRail } from "@/components/ai-hub/RecentsRail";

/**
 * Chat two-pane: the Recents rail (server-fetched conversation list) beside the
 * welcome / conversation view. router.refresh() from the conversation page
 * re-runs this layout so new chats and auto-titles surface in the rail.
 */
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getEngagementContext();
  const conversations = ctx ? await listConversations(ctx.orgId, ctx.userId) : [];

  return (
    <div className="flex h-full">
      <div className="hidden w-[260px] shrink-0 border-r border-gray-200 lg:block">
        <RecentsRail conversations={conversations} />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
