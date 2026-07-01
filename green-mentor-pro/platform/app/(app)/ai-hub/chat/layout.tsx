import { unstable_rethrow } from "next/navigation";
import { getEngagementContext } from "@/lib/engagement-session";
import { listConversations } from "@/lib/chat/repo";
import { RecentsRail } from "@/components/ai-hub/RecentsRail";

/**
 * Chat two-pane: the Recents rail (server-fetched conversation list) beside the
 * welcome / conversation view. router.refresh() from the conversation page
 * re-runs this layout so new chats and auto-titles surface in the rail.
 */
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  // The Recents rail is non-critical chrome. If auth or the DB hiccups, degrade to
  // an empty rail rather than throwing — an unguarded throw here has no error
  // boundary above it, so it collapses the whole chat surface to Next's _global-error
  // 500 page (and the client's RSC fetch gets HTML instead of a payload).
  let conversations: Awaited<ReturnType<typeof listConversations>> = [];
  try {
    const ctx = await getEngagementContext();
    if (ctx) conversations = await listConversations(ctx.orgId, ctx.userId);
  } catch (e) {
    // Re-throw Next's internal control-flow signals (dynamic-rendering bailout from
    // cookies(), redirect(), notFound()); only genuine data/auth failures should
    // fall through to the graceful empty-rail path.
    unstable_rethrow(e);
    console.error("ChatLayout: failed to load recents rail", e);
  }

  return (
    <div className="flex h-full">
      <div className="hidden w-[260px] shrink-0 border-r border-gray-200 lg:block">
        <RecentsRail conversations={conversations} />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
