import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEngagementContext } from "@/lib/engagement-session";
import { listConversations } from "@/lib/chat/repo";
import { generateChatSuggestions } from "@/lib/chat/suggestions";
import { FALLBACK_SUGGESTIONS } from "@/lib/chat/suggestion-defaults";

export const runtime = "nodejs";

// Small per-instance cache so we don't hit the model on every welcome-page mount.
// Keyed by user + a signature of the personalization inputs, refreshed on a TTL.
const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; suggestions: string[] }>();

// GET /api/ai-hub/chat/suggestions — AI-generated quick-start chips for the Chat
// welcome screen, personalized from the user's onboarding profile + recent chats.
// Always resolves with a { suggestions } list (defaults on any failure).
export async function GET() {
  const ctx = await getEngagementContext();
  // The welcome screen is already behind auth; if somehow unauthenticated, still
  // return safe defaults rather than a 401 so the chips render.
  if (!ctx) return NextResponse.json({ suggestions: FALLBACK_SUGGESTIONS });

  try {
    const supabase = await createClient();
    const [{ data: profile }, conversations] = await Promise.all([
      supabase.from("profiles").select("segment, goals").eq("id", ctx.userId).maybeSingle(),
      listConversations(ctx.orgId, ctx.userId).catch(() => []),
    ]);

    const segment = (profile?.segment as string | null) ?? null;
    const goals = (profile?.goals as string[] | null) ?? [];
    const recentTitles = conversations
      .map((c) => c.title)
      .filter((t): t is string => !!t)
      .slice(0, 5);

    const key = `${ctx.userId}|${segment ?? ""}|${goals.join(",")}|${recentTitles.join("|")}`;
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && now - hit.at < TTL_MS) {
      return NextResponse.json({ suggestions: hit.suggestions });
    }

    const suggestions = await generateChatSuggestions({ segment, goals, recentTitles });
    cache.set(key, { at: now, suggestions });
    if (cache.size > 500) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: FALLBACK_SUGGESTIONS });
  }
}
