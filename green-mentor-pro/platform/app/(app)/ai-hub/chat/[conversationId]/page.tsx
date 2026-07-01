import { notFound, redirect } from "next/navigation";
import type { UIMessage } from "ai";
import { getEngagementContext } from "@/lib/engagement-session";
import { assertOwner, loadMessages } from "@/lib/chat/repo";
import { ChatConversation } from "@/components/ai-hub/ChatConversation";

// SSR-hydrate the transcript and hand it to the client as initialMessages — this
// removes the old fetch-on-mount race that could clobber a just-sent turn, and
// saves a round-trip. Keyed by conversationId so switching conversations remounts.
export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const ctx = await getEngagementContext();
  if (!ctx) redirect(`/login?next=/ai-hub/chat/${conversationId}`);
  if (!(await assertOwner(ctx.orgId, ctx.userId, conversationId))) notFound();

  const initialMessages = (await loadMessages(ctx.orgId, conversationId)) as unknown as UIMessage[];

  return (
    <ChatConversation key={conversationId} conversationId={conversationId} initialMessages={initialMessages} />
  );
}
