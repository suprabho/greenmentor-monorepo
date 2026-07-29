// The metered AI surfaces and their allowances. Pure constants, no I/O — kept out
// of lib/ai/usage.ts so UI can import them without pulling in the Supabase server
// client (which imports next/headers and is server-only).

export type AiSurface = "buddy_chat" | "hub_chat" | "engagement_chat" | "energy_extract";

export const AI_SURFACES: AiSurface[] = ["buddy_chat", "hub_chat", "engagement_chat", "energy_extract"];

export const SURFACE_LABEL: Record<AiSurface, string> = {
  buddy_chat: "ESG Buddy",
  hub_chat: "AI Hub chat",
  engagement_chat: "Report Copilot",
  energy_extract: "Smart Upload",
};

/**
 * Free calls per surface per day (Asia/Kolkata, matching the streak boundary in
 * lib/academy/time.ts). PRD §5 sets the shape for chat — "Ask AI capped (e.g. 20
 * questions/day)". Extraction is far more expensive per call, so it gets a
 * tighter allowance.
 */
export const FREE_DAILY_CALLS: Record<AiSurface, number> = {
  buddy_chat: 20,
  hub_chat: 20,
  engagement_chat: 20,
  energy_extract: 3,
};

/**
 * Balance a user must have to make a *metered* (post-allowance) call. Metered
 * pricing can't know the exact cost before the run, so this floor stands in for a
 * pre-run price: a plausible worst case for the surface.
 *
 * Sized to the realistic worst case, not the average — the AI Hub chat can run a
 * full Opus skill agent inside the stream (see maxDuration=300 on that route), and
 * extraction sends a whole document to a vision model.
 */
export const MIN_BALANCE_CREDITS: Record<AiSurface, number> = {
  buddy_chat: 5,
  hub_chat: 25,
  engagement_chat: 15,
  energy_extract: 10,
};

/** Message shown when a metered call is refused. */
export function insufficientCreditsMessage(surface: AiSurface): string {
  return `You've used today's free ${SURFACE_LABEL[surface]} allowance and your credit balance is too low to continue. Earn credits in the Academy or top up to keep going.`;
}
