"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Leaf } from "@phosphor-icons/react";
import { MessageList } from "./MessageList";
import { ChatComposer } from "./ChatComposer";
import { ChatError } from "./ChatError";
import { ScopeQuestions } from "./ScopeQuestions";
import { fetchWithErrorHandlers } from "@/lib/chat/fetch";

/**
 * Middle column of the Cowork engagement view: the Report Copilot. Streams via
 * useChat, hydrates the persisted conversation on open, and refreshes the board
 * when a turn finishes. Hydration is gated so it can't clobber a live turn, and
 * errors surface inline (Chat used to swallow them → "no response at all").
 *
 * Kickoff scope questions surface here — pinned above the composer via
 * ScopeQuestions so they stay visible in a long thread; they can be answered with
 * its controls or by typing to the Copilot. `refreshKey` (the board's tick)
 * re-fetches them after a turn resolves any via the chat tool.
 */
export function EngagementConversation({
  engagementId,
  refreshKey,
  onChange,
}: {
  engagementId: string;
  refreshKey: number;
  onChange: () => void;
}) {
  const api = `/api/ai-hub/engagements/${engagementId}/chat`;
  const transport = useRef(new DefaultChatTransport({ api, fetch: fetchWithErrorHandlers }));
  const { messages, sendMessage, status, setMessages, error, regenerate } = useChat({
    transport: transport.current,
    onError: (e) => console.error("[ai-hub/engagement-chat]", e),
  });
  const busy = status === "submitted" || status === "streaming";
  const [hydrated, setHydrated] = useState(false);

  // Hydrate the persisted conversation on open. Only seed while still empty so a
  // slow GET can't overwrite a turn the user already sent; the composer is gated
  // on `hydrated` so that window is tiny.
  useEffect(() => {
    let cancelled = false;
    fetch(api)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !Array.isArray(j.messages) || j.messages.length === 0) return;
        setMessages((cur) => (cur.length === 0 ? j.messages : cur));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [api, setMessages]);

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
        {messages.length === 0 && !error && (
          <p className="max-w-md text-[13px] leading-relaxed text-gray-500">
            Ask me to capture requirements, run the next phase, summarize an artifact, or approve a gate.
          </p>
        )}
        <MessageList
          messages={messages}
          status={status}
          thinkingLabel="Copilot is thinking…"
          onSendMessage={(text) => sendMessage({ text })}
        />
        <ChatError error={error} onRetry={() => regenerate()} />
      </div>

      {/* Pinned above the composer so open scope questions stay in view.
          Renders nothing (no gap) when there are none. */}
      <ScopeQuestions engagementId={engagementId} refreshKey={refreshKey} onChange={onChange} />

      <div className="shrink-0 border-t border-gray-200 bg-white p-3">
        <ChatComposer
          onSend={(text) => sendMessage({ text })}
          busy={busy || !hydrated}
          placeholder="e.g. capture our frameworks as BRSR + GRI, then run kickoff"
        />
      </div>
    </div>
  );
}
