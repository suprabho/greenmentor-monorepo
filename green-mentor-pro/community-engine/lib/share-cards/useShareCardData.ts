"use client";

import { useEffect, useState } from "react";
import type { ShareCardArticle, ShareCardData, ShareCardJob } from "./types";

/** Fetch one studio data endpoint's `{ ok, items }` envelope, throwing on failure. */
async function load<T>(url: string): Promise<T[]> {
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    items?: T[];
    error?: string;
  };
  if (!res.ok || !body.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.items ?? [];
}

/**
 * Fetches the entity data the studio's layers + pickers resolve against (once,
 * on mount) and exposes it as a ShareCardData store for the
 * ShareCardDataProvider. Mirrors footshorts' useFootshortsCardData. Sources are
 * fetched independently so a jobs failure doesn't blank the articles studio
 * (and vice versa) — `error` surfaces the first failure.
 */
export function useShareCardData(): {
  data: ShareCardData;
  loading: boolean;
  error: string | null;
} {
  const [articles, setArticles] = useState<ShareCardArticle[]>([]);
  const [jobs, setJobs] = useState<ShareCardJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      // 200 (the routes' cap) so the pickers can search beyond the newest page.
      const [a, j] = await Promise.allSettled([
        load<ShareCardArticle>("/api/share-cards/data/articles?limit=200"),
        load<ShareCardJob>("/api/share-cards/data/jobs?limit=200"),
      ]);
      if (!alive) return;
      if (a.status === "fulfilled") setArticles(a.value);
      if (j.status === "fulfilled") setJobs(j.value);
      const failed = [a, j].find((r): r is PromiseRejectedResult => r.status === "rejected");
      setError(
        failed
          ? failed.reason instanceof Error
            ? failed.reason.message
            : "Could not load studio data"
          : null
      );
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { data: { articles, jobs }, loading, error };
}
