"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { MessageList } from "./MessageList";
import { ChatComposer, type ComposerAttachment } from "./ChatComposer";
import { ChatError } from "./ChatError";
import { CHAT_SKILLS } from "./skills";
import { takePendingMessage } from "@/lib/chat/pending";
import { fetchWithErrorHandlers } from "@/lib/chat/fetch";

/**
 * A single persisted chat conversation: stream + attachments + skills. The
 * transcript is hydrated server-side (initialMessages) so there's no fetch-on-mount
 * race with the live turn. The parent keys this by conversationId, so switching
 * conversations remounts with a fresh seed.
 */
export function ChatConversation({
  conversationId,
  initialMessages,
}: {
  conversationId: string;
  initialMessages: UIMessage[];
}) {
  const router = useRouter();
  const api = `/api/ai-hub/chat/conversations/${conversationId}`;
  // Build the transport once — a new instance each render would churn useChat.
  const transport = useRef(new DefaultChatTransport({ api, fetch: fetchWithErrorHandlers }));
  const { messages, sendMessage, status, error, regenerate } = useChat({
    messages: initialMessages,
    transport: transport.current,
    onError: (e) => console.error("[ai-hub/chat]", e),
  });
  const busy = status === "submitted" || status === "streaming";
  const sentPending = useRef(false);
  const prevStatus = useRef(status);

  // Fire the handoff message from the welcome state exactly once.
  useEffect(() => {
    if (sentPending.current) return;
    const pending = takePendingMessage(conversationId);
    if (pending?.text) {
      sentPending.current = true;
      sendMessage({ text: pending.text, files: pending.files });
    }
  }, [conversationId, sendMessage]);

  // On turn completion, refresh the server rail (new title / ordering).
  useEffect(() => {
    if (prevStatus.current !== "ready" && status === "ready") router.refresh();
    prevStatus.current = status;
  }, [status, router]);

  const send = (text: string, files: ComposerAttachment[]) => sendMessage({ text, files });

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl">
          {messages.length === 0 && status === "ready" && !error && (
            <p className="text-[13px] text-gray-400">Send a message to start this conversation.</p>
          )}
          <MessageList
            messages={messages}
            status={status}
            thinkingLabel="Thinking…"
            onSendMessage={(text) => sendMessage({ text })}
          />
          <ChatError error={error} onRetry={() => regenerate()} />
        </div>
      </div>
      <div className="shrink-0 border-t border-gray-200 bg-white/80 p-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <ChatComposer onSend={send} busy={busy} uploadUrl={`${api}/upload`} skills={CHAT_SKILLS} placeholder="Reply…" />
        </div>
      </div>
    </div>
  );
}
