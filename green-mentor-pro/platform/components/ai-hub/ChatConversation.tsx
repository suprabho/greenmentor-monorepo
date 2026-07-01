"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageList } from "./MessageList";
import { ChatComposer, type ComposerAttachment } from "./ChatComposer";
import { CHAT_SKILLS } from "./skills";
import { takePendingMessage } from "@/lib/chat/pending";

/** A single persisted chat conversation: hydrate + stream + attachments + skills. */
export function ChatConversation({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const api = `/api/ai-hub/chat/conversations/${conversationId}`;
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api }),
  });
  const busy = status === "submitted" || status === "streaming";
  const sentPending = useRef(false);
  const prevStatus = useRef(status);

  // Hydrate the persisted transcript on open.
  useEffect(() => {
    fetch(api)
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.messages) && j.messages.length) setMessages(j.messages);
      })
      .catch(() => {});
  }, [api, setMessages]);

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
          {messages.length === 0 && status === "ready" && (
            <p className="text-[13px] text-gray-400">Send a message to start this conversation.</p>
          )}
          <MessageList
            messages={messages}
            status={status}
            thinkingLabel="Thinking…"
            onSendMessage={(text) => sendMessage({ text })}
          />
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
