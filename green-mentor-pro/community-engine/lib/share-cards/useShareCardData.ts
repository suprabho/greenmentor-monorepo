"use client";

import { useEffect, useState } from "react";
import type { ShareCardArticle, ShareCardData } from "./types";

/**
 * Fetches the news-pipe articles the studio's layers + pickers resolve against
 * (once, on mount) and exposes them as a ShareCardData store for the
 * ShareCardDataProvider. Mirrors footshorts' useFootshortsCardData, sized down
 * to the one data source v1 needs.
 */
export function useShareCardData(): {
  data: ShareCardData;
  loading: boolean;
  error: string | null;
} {
  const [articles, setArticles] = useState<ShareCardArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/share-cards/data/articles");
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          items?: ShareCardArticle[];
          error?: string;
        };
        if (!res.ok || !body.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        if (alive) {
          setArticles(body.items ?? []);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not load articles");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { data: { articles }, loading, error };
}
