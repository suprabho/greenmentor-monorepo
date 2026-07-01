import { createAdminClient } from "@gm/orchestrator";
import type { Conversation, StoredChatMessage } from "./types";

/**
 * Persistence for the standalone /ai-hub Chat. Mirrors @gm/orchestrator's
 * db/messages.ts (delete-then-insert replace) but adds a conversation container
 * and scopes everything by org + user. Uses the same service-role admin client as
 * lib/tenancy.ts, so RLS is bypassed and (orgId, userId) is the tenant boundary —
 * every function filters by both.
 */

export async function createConversation(
  orgId: string,
  userId: string,
  title: string | null = null
): Promise<{ id: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("chat_conversations")
    .insert({ org_id: orgId, user_id: userId, title })
    .select("id")
    .single();
  if (error || !data) throw new Error(`createConversation: ${error?.message ?? "no row"}`);
  return { id: data.id as string };
}

export async function listConversations(orgId: string, userId: string): Promise<Conversation[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("chat_conversations")
    .select("id, title, created_at, updated_at, last_message_at")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`listConversations: ${error.message}`);
  return (data ?? []) as Conversation[];
}

/** Guards every read/write/stream — 404 when the conversation isn't the user's. */
export async function assertOwner(orgId: string, userId: string, conversationId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("chat_conversations")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("id", conversationId)
    .maybeSingle();
  return !!data;
}

export async function loadMessages(orgId: string, conversationId: string): Promise<StoredChatMessage[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("chat_messages")
    .select("id, role, parts")
    .eq("org_id", orgId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`loadMessages: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    role: r.role as StoredChatMessage["role"],
    parts: (r.parts as unknown[]) ?? [],
  }));
}

/** Replace the conversation's stored messages with the full updated transcript. */
export async function replaceMessages(
  orgId: string,
  conversationId: string,
  messages: { id?: string; role: string; parts: unknown[] }[]
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("chat_messages").delete().eq("org_id", orgId).eq("conversation_id", conversationId);
  if (messages.length === 0) return;
  const rows = messages
    .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "system")
    .map((m) => ({
      org_id: orgId,
      conversation_id: conversationId,
      role: m.role,
      parts: (m.parts ?? []) as unknown,
    }));
  const { error } = await admin.from("chat_messages").insert(rows);
  if (error) throw new Error(`replaceMessages: ${error.message}`);
}

export async function renameConversation(
  orgId: string,
  userId: string,
  conversationId: string,
  title: string
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("chat_conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("id", conversationId);
  if (error) throw new Error(`renameConversation: ${error.message}`);
}

/** Set an auto-generated title only if one hasn't been set yet (never clobbers a rename). */
export async function setTitleIfEmpty(orgId: string, conversationId: string, title: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("chat_conversations")
    .update({ title })
    .eq("org_id", orgId)
    .eq("id", conversationId)
    .is("title", null);
  if (error) throw new Error(`setTitleIfEmpty: ${error.message}`);
}

/** Bump activity timestamps (called on stream finish). */
export async function touchConversation(orgId: string, conversationId: string): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("chat_conversations")
    .update({ last_message_at: now, updated_at: now })
    .eq("org_id", orgId)
    .eq("id", conversationId);
  if (error) throw new Error(`touchConversation: ${error.message}`);
}

export async function deleteConversation(orgId: string, userId: string, conversationId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("chat_conversations")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("id", conversationId);
  if (error) throw new Error(`deleteConversation: ${error.message}`);
}
