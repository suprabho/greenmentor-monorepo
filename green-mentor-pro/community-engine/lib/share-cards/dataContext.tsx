"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ShareCardArticle, ShareCardData } from "./types";

/**
 * The live news-pipe data the `gmcard:*` layers resolve against. The host
 * (the studio editor, or the render page via the export handoff) fetches it and
 * INJECTS it here — modules never fetch directly. The live preview and the
 * export render both mount under one provider, so there is a single data path.
 * Mirrors footshorts' FootshortsDataProvider.
 */
const DataCtx = createContext<ShareCardData | null>(null);

export function ShareCardDataProvider({
  value,
  children,
}: {
  value: ShareCardData;
  children: ReactNode;
}) {
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

function useShareCardData(): ShareCardData {
  const v = useContext(DataCtx);
  if (!v) {
    throw new Error("gmcard:* module rendered outside <ShareCardDataProvider>");
  }
  return v;
}

export function useShareCardArticles(): ShareCardArticle[] {
  return useShareCardData().articles;
}

export function useShareCardArticle(id: string): ShareCardArticle | null {
  const articles = useShareCardData().articles;
  return articles.find((a) => a.id === id) ?? null;
}
