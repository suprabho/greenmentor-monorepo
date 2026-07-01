"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChatComposer, type ComposerAttachment } from "./ChatComposer";
import { SuggestionChips } from "./SuggestionChips";
import { CHAT_SKILLS } from "./skills";
import { setPendingMessage } from "@/lib/chat/pending";

/**
 * Chat welcome / empty state. The first send creates a conversation row, stashes
 * the message for the conversation page to fire on mount, and routes there.
 * Attachments aren't offered here (the upload route is per-conversation) — they
 * light up once inside a conversation.
 */
export function ChatWelcome({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(text: string, files: ComposerAttachment[]) {
    if (creating || !text.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-hub/chat/conversations", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setPendingMessage(json.id, { text, files });
      router.push(`/ai-hub/chat/${json.id}`);
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
