"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatComposer, type ComposerAttachment } from "./ChatComposer";
import { SuggestionChips } from "./SuggestionChips";
import { CHAT_SKILLS } from "./skills";
import { setPendingMessage } from "@/lib/chat/pending";

/**
 * Chat welcome / empty state. The first send creates a conversation row, stashes
 * the message for the conversation page to fire on mount, and routes there.
 *
 * Attachments work here too, even though the upload route is per-conversation: the
 * conversation row is created lazily on the first attach (or on send, whichever comes
 * first) and cached in `conversationId`, so the upload and the message it belongs to
 * land in the same conversation. Without this the document-shaped skills
 * (/extract-bill, /understand-epd) had no way to receive a document on the very first
 * message — the paperclip only appeared after a round-trip.
 */
export function ChatWelcome({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationId = useRef<string | null>(null);

  /** Create-once: the id is reused by a later attach and by the eventual send. */
  async function ensureConversation(): Promise<string> {
    if (conversationId.current) return conversationId.current;
    const res = await fetch("/api/ai-hub/chat/conversations", { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    conversationId.current = json.id as string;
    return conversationId.current;
  }

  async function start(text: string, files: ComposerAttachment[]) {
    if (creating || (!text.trim() && files.length === 0)) return;
    setCreating(true);
    setError(null);
    try {
      const id = await ensureConversation();
      setPendingMessage(id, { text, files });
      router.push(`/ai-hub/chat/${id}`);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="w-full max-w-2xl space-y-6">
        <h1 className="text-center font-display text-[30px] tracking-tight text-ink">Welcome, {displayName}</h1>
        <ChatComposer
          onSend={start}
          busy={creating}
          placeholder="How can I help with your ESG reporting?"
          uploadUrl={async () => `/api/ai-hub/chat/conversations/${await ensureConversation()}/upload`}
          skills={CHAT_SKILLS}
          size="hero"
          autoFocus
        />
        <SuggestionChips onPick={(t) => start(t, [])} />
        {error && <p className="text-center text-[13px] text-danger">{error}</p>}
      </div>
    </div>
  );
}
