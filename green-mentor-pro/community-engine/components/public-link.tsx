"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowSquareOut, Check, LinkSimple } from "@phosphor-icons/react";

/**
 * The learner-facing deeplink for a published row, with copy-to-clipboard.
 *
 * Editors need this to put a webinar or job into a newsletter or WhatsApp
 * without leaving the hub. Only rendered for published rows — a draft's URL
 * 404s on the platform, since jobs_public / webinars_public filter on status.
 */
export function PublicLink({ url, label = "Public link" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (insecure origin, or permission denied) */
    }
  };

  return (
    <div className="mt-2 flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => void copy()}
        title={url}
        className="inline-flex max-w-full items-center gap-1 rounded-pill border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11.5px] font-medium text-gray-600 transition-colors hover:bg-gray-100"
      >
        {copied ? (
          <Check size={11} weight="bold" className="shrink-0 text-green-600" />
        ) : (
          <LinkSimple size={11} className="shrink-0" />
        )}
        <span className="truncate">{copied ? "Copied" : label}</span>
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label="Open public page"
        className="text-gray-400 transition-colors hover:text-ink"
      >
        <ArrowSquareOut size={12} />
      </a>
    </div>
  );
}
