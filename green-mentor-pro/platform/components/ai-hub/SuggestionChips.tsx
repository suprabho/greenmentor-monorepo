"use client";

import { useEffect, useState } from "react";
import { FALLBACK_SUGGESTIONS } from "@/lib/chat/suggestion-defaults";

/**
 * Claude-style quick-start chips under the welcome composer. Renders instantly
 * with sensible defaults, then swaps in AI-generated, profile-personalized
 * prompts from /api/ai-hub/chat/suggestions once they arrive. Any failure keeps
 * the defaults, so the chips are never empty.
 */
export function SuggestionChips({ onPick }: { onPick: (text: string) => void }) {
  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK_SUGGESTIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/ai-hub/chat/suggestions");
        if (!res.ok) return;
        const json = (await res.json()) as { suggestions?: unknown };
        const next = Array.isArray(json.suggestions)
          ? json.suggestions.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          : [];
        if (alive && next.length) setSuggestions(next);
      } catch {
        /* keep the defaults */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div
      className={`flex flex-wrap justify-center gap-2 transition-opacity duration-300 ${
        loading ? "opacity-60" : "opacity-100"
      }`}
    >
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onPick(s)}
          className="rounded-pill border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:border-teal-700 hover:text-teal-800"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
