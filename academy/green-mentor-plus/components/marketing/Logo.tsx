import Link from "next/link";
import { cn } from "@/lib/utils/cn";

interface LogoProps {
  className?: string;
  bare?: boolean;
  /** Light variant (dark text on light bg) or dark (white text on dark bg). */
  variant?: "light" | "dark";
}

/**
 * Greenmentor wordmark + sub-brand lockup.
 *
 * The Figma deck does not contain a brand logo file. The leaf glyph is the
 * working mark we ship while we wait for the real logo.
 *
 * TODO[Brand]: replace the leaf mark with the real Greenmentor logomark
 * when it's available.
 */
export function Logo({ className, bare = false, variant = "light" }: LogoProps) {
  const textColor = variant === "dark" ? "text-white" : "text-ink";
  const dotColor = "text-green-500";

  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {/* Working mark — concentric circles in neon green. */}
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        aria-hidden
        className="shrink-0"
      >
        <circle cx="12" cy="12" r="11" fill="#07D862" />
        <circle cx="12" cy="12" r="4.5" fill="#014A50" />
      </svg>
      <span className={cn("text-[20px] font-semibold tracking-tight", textColor)}>
        greenmentor
        <span className={dotColor}>.</span>
      </span>
    </span>
  );

  if (bare) return content;
  return (
    <Link href="/" className="inline-flex" aria-label="Greenmentor — home">
      {content}
    </Link>
  );
}

/**
 * Sub-brand lockup — the navigation-style "GM Academy" name set in ABeeZee.
 * Used on the hero and in the nav as a quiet identification of which surface
 * of the parent brand the user is on.
 */
export function SubBrand({ className }: { className?: string }) {
  return (
    <span className={cn("font-accent text-[15px] text-gray-700", className)}>
      GM Academy
    </span>
  );
}
