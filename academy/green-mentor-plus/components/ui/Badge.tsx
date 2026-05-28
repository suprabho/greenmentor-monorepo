import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

type Tone = "mint" | "neon" | "teal" | "outline-light" | "outline-dark";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Use the flat-rectangle eyebrow shape from the deck instead of pill. */
  rect?: boolean;
}

const tones: Record<Tone, string> = {
  // Mint chip on white — primary green text, Inter SemiBold (category pills)
  mint: "bg-green-100 text-green-700 font-semibold",
  // Neon accent
  neon: "bg-green-500 text-teal-900 font-bold",
  // Dark teal chip with mint text — eyebrow on dark
  teal: "bg-teal-800 text-green-100",
  // Outline on light
  "outline-light": "bg-white text-green-700 border border-black/[0.06]",
  // Outline on dark
  "outline-dark":
    "bg-teal-900 text-white border border-green-100/40",
};

export function Badge({
  tone = "mint",
  rect = false,
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[14px]",
        rect ? "rounded-none px-[18px] py-[10px]" : "rounded-[14px] px-[18px] py-[10px]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/**
 * Eyebrow — flat rectangle with ALL CAPS wide-tracking text. The deck's
 * signature labeling device.
 */
export function Eyebrow({
  tone = "teal",
  wide = false,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "teal" | "white" | "mint-on-teal";
  wide?: boolean;
}) {
  const toneClass =
    tone === "teal"
      ? "bg-teal-800 text-green-100"
      : tone === "mint-on-teal"
        ? "bg-teal-800 text-green-100"
        : "bg-white text-green-700 border border-black/[0.06]";
  return (
    <span
      className={cn(
        "inline-block px-[18px] py-[10px]",
        toneClass,
        wide ? "gm-eyebrow gm-eyebrow-wide" : "gm-eyebrow",
        className,
      )}
      {...props}
    />
  );
}
