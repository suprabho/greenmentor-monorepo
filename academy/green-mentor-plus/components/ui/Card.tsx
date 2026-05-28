import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * `light` — white card, slate-200 border, soft-card shadow stack (product world).
   * `dark` — rgba(7,216,98,0.15) fill + 1px neon border on dark teal (credibility moments).
   * `mint` — pale mint fade card (solution overview).
   */
  variant?: "light" | "dark" | "mint";
  interactive?: boolean;
}

const variants = {
  light:
    "bg-white border border-gray-200 rounded-[8px]",
  dark:
    "bg-[rgba(7,216,98,0.15)] border border-green-500 rounded-[24px] text-white",
  mint:
    "bg-section-fade border border-green-100 rounded-[20px]",
};

export function Card({
  variant = "light",
  interactive = false,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "p-8 transition-[border-color,transform,box-shadow] duration-200",
        variants[variant],
        interactive &&
          (variant === "dark"
            ? "cursor-pointer hover:bg-[rgba(7,216,98,0.22)] hover:-translate-y-0.5"
            : "cursor-pointer hover:border-green-700 hover:shadow-lift hover:-translate-y-0.5"),
        className,
      )}
      {...props}
    />
  );
}
