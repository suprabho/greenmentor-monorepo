"use client";

import { useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Leaf } from "@phosphor-icons/react";
import { MessageList } from "./MessageList";
import { ChatComposer } from "./ChatComposer";

/**
 * Middle column of the Cowork engagement view: the Report Copilot. Keeps the
 * original EngagementChat data logic (streaming useChat, GET-hydrate, refresh the
 * board when a turn finishes) but renders through the shared MessageList /
 * ChatComposer and fills its column height.
 */
export function EngagementConversation({
  engagementId,
  onChange,
}: {
  engagementId: string;
  onChange: () => void;
}) {
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: `/api/ai-hub/engagements/${engagementId}/chat` }),
  });
  const busy = status === "submitted" || status === "streaming";

  // Hydrate the persisted conversation on open.
  useEffect(() => {
    fetch(`/api/ai-hub/engagements/${engagementId}/chat`)
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.messages) && j.messages.length) setMessages(j.messages);
      })
      .catch(() => {});
  }, [engagementId, setMessages]);

  // A finished assistant turn may have mutated engagement state → refresh the board.
  useEffect(() => {
    if (status === "ready") onChange();
  }, [status, onChange]);

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
        <span className="grid size-6 place-items-center rounded-lg bg-green-700 text-white">
          <Leaf size={14} weight="fill" />
        </span>
        <span className="text-[13.5px] font-semibold text-ink">Report Copilot</span>
        <span className="text-[11.5px] text-gray-500">drives the pipeline by chat</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="max-w-md text-[13px] leading-relaxed text-gray-500">
            Ask me to capture requirements, run the next phase, summarize an artifact, or approve a gate.
          </p>
        )}
        <MessageList messages={messages} status={status} thinkingLabel="Copilot is thinking…" />
      </div>

      <div className="shrink-0 border-t border-gray-200 bg-white p-3">
        <ChatComposer
          onSend={(text) => sendMessage({ text })}
          busy={busy}
          placeholder="e.g. capture our frameworks as BRSR + GRI, then run kickoff"
        />
      </div>
    </div>
  );
}
