import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShareCardRenderPayload } from "./types";

/**
 * Export handoff — how the export API gets a card config into the chrome-less
 * /share-cards/render page it screenshots. A query param can't carry the
 * payload (uploaded images embed multi-MB data URLs), so the config parks in a
 * short-lived Supabase row addressed by an unguessable UUID:
 *
 *   putHandoff (authenticated admin) → Playwright loads /render?id=… →
 *   getHandoff (anon — the headless browser has no session) → delHandoff.
 *
 * Rows self-expire: reads reject anything older than TTL_MS and every write
 * sweeps expired rows (deconXpromad's handoff.ts pattern). RLS: authenticated
 * may insert/delete, anon+authenticated may select — the exposure window is an
 * admin-authored card config over already-public article rows, for ≤5 minutes,
 * behind a v4 UUID.
 */

const TABLE = "community_share_card_exports";
const TTL_MS = 5 * 60 * 1000;

export async function putHandoff(
  supabase: SupabaseClient,
  payload: ShareCardRenderPayload
): Promise<string> {
  // Best-effort sweep of expired rows — keeps the table from accumulating.
  const cutoff = new Date(Date.now() - TTL_MS).toISOString();
  await supabase.from(TABLE).delete().lt("created_at", cutoff);

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ payload })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function getHandoff(
  supabase: SupabaseClient,
  id: string
): Promise<ShareCardRenderPayload | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("payload, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  if (Date.now() - new Date(data.created_at as string).getTime() > TTL_MS) return null;
  return data.payload as ShareCardRenderPayload;
}

export async function delHandoff(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.from(TABLE).delete().eq("id", id);
}
