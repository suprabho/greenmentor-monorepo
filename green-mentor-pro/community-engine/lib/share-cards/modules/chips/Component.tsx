"use client";

import { useEffect } from "react";
import type { VizRenderProps } from "@vismay/viz-engine";
import { useShareCardArticle } from "../../dataContext";
import { EntityChipRow } from "./EntityChipRow";
import type { GmChipsConfig } from "./index";

/** `gmcard:entity-chips` — a free-standing row of a picked article's entity tags. */
export default function EntityChipsComponent({
  config,
  noteReady,
}: VizRenderProps<GmChipsConfig>) {
  const article = useShareCardArticle(config.articleId);

  useEffect(() => {
    const h = requestAnimationFrame(() => noteReady());
    return () => cancelAnimationFrame(h);
  }, [noteReady]);

  if (!article || article.entities.length === 0) {
    return (
      <div className="flex h-full items-center p-2 text-[12px]" style={{ color: "var(--gmcard-muted)" }}>
        Pick an article with tags →
      </div>
    );
  }

  return (
    <div className="flex h-full items-center">
      <EntityChipRow entities={article.entities} max={config.max} tone={config.tone} />
    </div>
  );
}
