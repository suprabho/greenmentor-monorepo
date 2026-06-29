import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  label: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  size?: "default" | "large";
  className?: string;
  onDark?: boolean;
}

/**
 * The deck's signature section header — Inter Bold sentence-case in primary
 * green, with a 1px dashed neon hairline below.
 */
export function SectionHeader({
  label,
  title,
  description,
  align = "left",
  size = "default",
  className,
  onDark = false,
}: SectionHeaderProps) {
  return (
    <header
      className={cn(
        align === "center" ? "text-center mx-auto" : "text-left",
        "max-w-3xl",
        className,
      )}
    >
      <p
        className={cn(
          "gm-section-label",
          onDark ? "text-green-500" : "text-green-700",
          size === "large" ? "text-[40px] md:text-[56px]" : "text-[32px] md:text-[40px]",
        )}
      >
        {label}
      </p>
      <div
        aria-hidden
        className={cn(
          "gm-section-rule mt-3",
          align === "center" ? "mx-auto" : "",
        )}
      />
      {title ? (
        <h2
          className={cn(
            "font-display mt-6 leading-tight tracking-[-0.02em]",
            onDark ? "text-white" : "text-ink",
            size === "large"
              ? "text-[40px] md:text-[56px]"
              : "text-[28px] md:text-[40px]",
          )}
        >
          {title}
        </h2>
      ) : null}
      {description ? (
        <p
          className={cn(
            "mt-5 text-[18px] leading-relaxed md:text-[20px]",
            onDark ? "text-white/80" : "text-gray-700",
          )}
        >
          {description}
        </p>
      ) : null}
    </header>
  );
}
