"use client";

import { useEffect } from "react";
import type { VizRenderProps } from "@vismay/viz-engine";
import { useShareCardArticle } from "../../dataContext";
import { cardDate, proxiedImage } from "../shared";
import { EntityChipRow } from "../chips/EntityChipRow";
import type { GmArticleConfig } from "./index";

/** `gmcard:article` — a news-pipe article as the card's hero: source eyebrow,
 *  headline, optional summary/date/entity chips, optional photo. All colors run
 *  through the frame's --gmcard-* vars so the layer follows the card theme. */
export default function ArticleCardComponent({
  config,
  noteReady,
}: VizRenderProps<GmArticleConfig>) {
  const article = useShareCardArticle(config.articleId);

  useEffect(() => {
    if (!article) return;
    const h = requestAnimationFrame(() => noteReady());
    return () => cancelAnimationFrame(h);
  }, [article, noteReady]);

  if (!article) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-[13px]" style={{ color: "var(--gmcard-muted)" }}>
        Pick an article →
      </div>
    );
  }

  const meta: string[] = [];
  if (!config.hideDate && article.published_at) meta.push(cardDate(article.published_at));

  const source = !config.hideSource && article.source ? (
    <div
      className="text-[13px] font-bold uppercase tracking-[1.6px]"
      style={{ color: "var(--gmcard-accent)" }}
    >
      {article.source}
    </div>
  ) : null;

  const headline = (
    <div
      className="font-extrabold"
      style={{
        color: "var(--gmcard-text)",
        fontSize: config.variant === "compact" ? 22 : 32,
        lineHeight: 1.12,
        letterSpacing: "-0.01em",
      }}
    >
      {article.title}
    </div>
  );

  const summary =
    !config.hideSummary && config.variant !== "compact" && article.summary ? (
      <p className="line-clamp-5 text-[15px] leading-relaxed" style={{ color: "var(--gmcard-muted)" }}>
        {article.summary}
      </p>
    ) : null;

  const metaRow = meta.length > 0 ? (
    <div className="text-[12px] font-medium" style={{ color: "var(--gmcard-muted)" }}>
      {meta.join(" · ")}
    </div>
  ) : null;

  const chips = !config.hideEntities && article.entities.length > 0 ? (
    <EntityChipRow entities={article.entities} max={4} tone="glass" />
  ) : null;

  if (config.variant === "image-led" && article.image_url) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="relative min-h-0 flex-[1.1] overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proxiedImage(article.image_url)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5 pt-4">
          {source}
          {headline}
          {summary}
          <div className="flex items-center justify-between gap-3">
            {metaRow}
            {chips}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col justify-center gap-3 px-1">
      {source}
      {headline}
      {summary}
      {metaRow}
      {chips}
    </div>
  );
}
