"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Check, ShareNetwork } from "@phosphor-icons/react";

/**
 * Share affordance for the admin tables — hands a row's learner-platform
 * deeplink to the editor so it can go straight into a newsletter or WhatsApp.
 *
 * Native share sheet on phones; everywhere else the button copies the URL,
 * with the inline "Copied" flash as feedback. Same conventions as the
 * platform's components/share/share-button.tsx, except it takes the absolute
 * URL from lib/share-link.ts — the target lives on the platform origin, not
 * this app's.
 */

const COPIED_MS = 1500;

// Phones only: Android tablets omit "Mobile" from their UA, and iPadOS ≥13
// presents a macOS desktop UA — so both land in the copy branch by design.
const isPhoneUA = () =>
  typeof navigator !== "undefined" && /iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent);

export function ShareButton({
  url,
  title,
  className,
}: {
  /** Absolute URL, e.g. from publicJobUrl() / publicNewsUrl(). */
  url: string;
  /** Used as the native share sheet's title. */
  title: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const share = useCallback(async () => {
    if (isPhoneUA() && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* dismissed */
      }
      return;
    }

    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      /* clipboard unavailable (insecure origin, or permission denied) */
    }
  }, [url, title]);

  return (
    <button
      type="button"
      onClick={() => void share()}
      title={url}
      className={clsx(
        "inline-flex items-center gap-1 text-[12px] font-medium transition-colors",
        copied ? "text-green-700" : "text-gray-600 hover:text-ink",
        className,
      )}
    >
      {copied ? <Check size={12} weight="bold" /> : <ShareNetwork size={12} />}
      {copied ? "Copied" : "Share"}
    </button>
  );
}
