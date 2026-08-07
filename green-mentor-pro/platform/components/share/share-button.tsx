"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Check, LinkSimple, ShareNetwork } from "@phosphor-icons/react";

// Share affordance for the deeplinked surfaces (webinar / job / feed post).
//
// Takes an app-relative `path` and resolves the origin from window.location, so
// dev, preview and production all produce a URL that actually works without
// threading siteUrl() through the server components that render the cards.
// (lib/share/url.ts is the server-side counterpart, used for metadata.)
//
// Native share sheet on phones only; on desktop and tablets the button is a
// copy-link affordance instead — desktop browsers expose navigator.share too,
// and their OS share sheets are worse than just putting the URL on the
// clipboard. Deliberately no toast: this app has no toast primitive, and the
// inline "Copied" flash is the established feedback.

const COPIED_MS = 1500;

// Phones only: Android tablets omit "Mobile" from their UA, and iPadOS ≥13
// presents a macOS desktop UA — so both land in the copy branch by design.
const isPhoneUA = () =>
  typeof navigator !== "undefined" && /iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent);

export function useShare(path: string, title: string) {
  const [copied, setCopied] = useState(false);
  // False during SSR and the first client paint so hydration matches; phones
  // flip to the share presentation right after mount.
  const [native, setNative] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setNative(isPhoneUA()), []);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const share = useCallback(async () => {
    const url = `${window.location.origin}${path}`;

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
  }, [path, title]);

  return { share, copied, native };
}

export function ShareButton({
  path,
  title,
  variant = "icon",
  className,
}: {
  /** App-relative path, e.g. "/jobs/senior-esg-analyst-8b21f0ac4e". */
  path: string;
  /** Used as the native share sheet's title. */
  title: string;
  /** "icon" for dense card action rows, "full" for detail-page headers. */
  variant?: "icon" | "full";
  className?: string;
}) {
  const { share, copied, native } = useShare(path, title);
  const label = copied ? "Copied" : native ? "Share" : "Copy link";

  return (
    <button
      type="button"
      onClick={() => void share()}
      // aria-label carries the state for screen readers in icon mode, where
      // there's no visible text to announce.
      aria-label={variant === "icon" ? label : undefined}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-full border border-gray-200 font-semibold text-gray-700 transition-colors hover:bg-gray-50",
        variant === "icon" ? "size-[34px] shrink-0" : "px-3.5 py-1.5 text-[12.5px]",
        className
      )}
    >
      {copied ? (
        <Check size={14} weight="bold" className="text-green-700" />
      ) : native ? (
        <ShareNetwork size={14} />
      ) : (
        <LinkSimple size={14} />
      )}
      {variant === "full" && label}
    </button>
  );
}
