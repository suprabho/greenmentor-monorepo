"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Check, ShareNetwork } from "@phosphor-icons/react";

/**
 * Share affordance for the admin tables — hands a row's learner-platform
 * deeplink to the editor so it can go straight into a newsletter or WhatsApp.
 *
 * Native share sheet on phones; everywhere else the button copies the URL,
 * flashing a green check as feedback. Icon-only so it fits the dense action
 * rows. Same conventions as the platform's components/share/share-button.tsx,
 * except it takes the absolute URL from lib/share-link.ts — the target lives
 * on the platform origin, not this app's.
 */

const COPIED_MS = 1500;

// Phones only: Android tablets omit "Mobile" from their UA, and iPadOS ≥13
// presents a macOS desktop UA — so both land in the copy branch by design.
const isPhoneUA = () =>
  typeof navigator !== "undefined" && /iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent);

/** Shared look for the icon-only actions in AdminTable rows — pair with a
 *  `title` + `aria-label`, since there's no visible text to announce. */
export const iconActionCls =
  "grid size-7 shrink-0 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-ink disabled:opacity-40";

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

  // aria-label carries the state for screen readers — icon-only, so there's
  // no visible text to announce.
  return (
    <button
      type="button"
      onClick={() => void share()}
      title={copied ? "Copied" : `Share — ${url}`}
      aria-label={copied ? "Copied" : "Share"}
      className={clsx(iconActionCls, copied && "text-green-700 hover:text-green-700", className)}
    >
      {copied ? <Check size={15} weight="bold" /> : <ShareNetwork size={15} />}
    </button>
  );
}
