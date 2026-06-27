import { createAdminClient } from "../admin";

/** A persisted chat message, shaped to round-trip with the AI SDK UIMessage. */
export interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: unknown[];
}

export async function loadMessages(orgId: string, engagementId: string): Promise<StoredMessage[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("esg_messages")
    .select("id, role, parts")
    .eq("org_id", orgId)
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`loadMessages: ${error.message}`);
  return (data ?? []).map((r) => ({ id: r.id as string, role: r.role as StoredMessage["role"], parts: (r.parts as unknown[]) ?? [] }));
}

/**
 * Replace the engagement's stored conversation with `messages` (the full updated
 * UI conversation from the stream's onFinish). Simple + correct for a single-pane
 * per-engagement chat; concurrent writers are out of scope for v1.
 */
export async function replaceMessages(
  orgId: string,
  engagementId: string,
  messages: { id?: string; role: string; parts: unknown[] }[],
  createdBy: string | null,
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("esg_messages").delete().eq("org_id", orgId).eq("engagement_id", engagementId);
  if (messages.length === 0) return;
  const rows = messages
    .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "system")
    .map((m) => ({
      org_id: orgId,
      engagement_id: engagementId,
      role: m.role,
      parts: (m.parts ?? []) as unknown,
      created_by: createdBy,
    }));
  const { error } = await admin.from("esg_messages").insert(rows);
  if (error) throw new Error(`replaceMessages: ${error.message}`);
}
