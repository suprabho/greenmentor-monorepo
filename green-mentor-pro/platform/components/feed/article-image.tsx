"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Newspaper } from "@phosphor-icons/react";

/**
 * Article thumbnail with a branded gradient fallback.
 *
 * A client component purely for `onError`: about a third of feed articles carry
 * a publisher URL that will eventually 404, move behind a CDN rule, or expire.
 * Rendering the fallback only when `src` is null left those cards showing a
 * broken-image glyph, which looks worse than no picture at all.
 *
 * The three surfaces that show articles — the feed card, the /feed/:slug hero
 * and the Home rail — used to each carry their own copy of this markup.
 */
export function ArticleImage({
  src,
  source,
  className,
  fallback = "source",
}: {
  src: string | null;
  /** Publisher name, shown in the gradient when there's no usable image. */
  source: string;
  /** Sizing is entirely the caller's — the Home rail is a fixed square, the
   *  card hero is a percentage of its pane. Nothing here sets width. */
  className: string;
  /** "source" writes the publisher name; "icon" is for the small Home rail squares. */
  fallback?: "source" | "icon";
}) {
  const [broken, setBroken] = useState(false);

  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary publisher hosts; next/image needs allow-listed domains
      <img
        src={src}
        alt=""
        draggable={false}
        onError={() => setBroken(true)}
        className={clsx("bg-gray-100 object-cover", className)}
      />
    );
  }

  return (
    <div
      className={clsx(
        "flex items-center justify-center bg-gradient-to-br from-teal-900 via-teal-800 to-green-700",
        className,
      )}
    >
      {fallback === "icon" ? (
        <Newspaper size={20} className="text-green-100/80" />
      ) : (
        <span className="px-6 text-center text-[15px] font-semibold tracking-wide text-green-100">{source}</span>
      )}
    </div>
  );
}
