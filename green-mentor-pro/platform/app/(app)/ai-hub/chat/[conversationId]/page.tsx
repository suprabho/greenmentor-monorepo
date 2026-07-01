"use client";

import { use } from "react";
import { ChatConversation } from "@/components/ai-hub/ChatConversation";

export default function ChatConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = use(params);
  return <ChatConversation conversationId={conversationId} />;
}
