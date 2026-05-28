import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  width?: "default" | "narrow" | "wide";
}

const widths = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
};

export function Container({
  width = "default",
  className,
  ...props
}: ContainerProps) {
  return (
    <div
      className={cn("mx-auto flex-1 w-full px-6 md:px-8", widths[width], className)}
      {...props}
    />
  );
}
