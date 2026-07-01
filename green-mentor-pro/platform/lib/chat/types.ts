// Shared types for the standalone /ai-hub Chat. Safe to import from both client
// and server (no server-only imports here).

export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

/** A persisted chat message, shaped to round-trip with the AI SDK UIMessage. */
export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: unknown[];
}
