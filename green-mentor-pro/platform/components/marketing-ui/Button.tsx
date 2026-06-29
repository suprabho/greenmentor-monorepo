"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "accent" | "outline" | "ghost-dark" | "ghost-light";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 font-semibold " +
  "rounded-[10px] select-none whitespace-nowrap " +
  "transition-[background-color,color,border-color,box-shadow,transform] duration-200 " +
  "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  // Primary green (#009C62) — Inter SemiBold on white
  primary:
    "bg-green-700 text-white border border-transparent hover:bg-[#00B873] hover:shadow-soft",
  // Neon accent (#07D862) — dark teal text — high-energy CTA
  accent:
    "bg-green-500 text-teal-900 font-bold border border-transparent hover:bg-[#16E372] hover:shadow-soft",
  // Outline — green-700 stroke 1.5px on transparent
  outline:
    "bg-transparent text-green-700 border-[1.5px] border-green-700 hover:bg-green-50",
  // Ghost on dark teal — teal fill + gradient border (white→neon-green), green glow
  "ghost-dark":
    "text-white border border-transparent " +
    "[background:linear-gradient(to_bottom,var(--color-teal-700),var(--color-teal-900))_padding-box,linear-gradient(to_bottom,rgba(255,255,255,0.55),rgba(7,216,98,0.6))_border-box] " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-2px_5px_rgba(0,0,0,0.35),0_4px_20px_-2px_rgba(7,216,98,0.45)] " +
    "hover:[background:linear-gradient(to_bottom,var(--color-teal-600),var(--color-teal-900))_padding-box,linear-gradient(to_bottom,rgba(255,255,255,0.8),rgba(7,216,98,0.85))_border-box] " +
    "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.24),inset_0_-2px_5px_rgba(0,0,0,0.35),0_6px_28px_0_rgba(7,216,98,0.6)]",
  // Ghost on light — minimal text button
  "ghost-light":
    "bg-transparent text-ink border border-transparent hover:bg-gray-50",
};

const sizes: Record<Size, string> = {
  sm: "h-10 px-5 text-[14px]",
  md: "h-12 px-7 text-[15px]",
  lg: "h-14 px-8 text-[16px]",
};

function ButtonContent({
  loading,
  iconLeft,
  iconRight,
  label,
}: {
  loading: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  label: ReactNode;
}) {
  return (
    <>
      {loading ? (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        iconLeft
      )}
      <span>{label}</span>
      {!loading && iconRight}
    </>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  asChild = false,
  loading = false,
  className,
  children,
  iconLeft,
  iconRight,
  disabled,
  ...props
}: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className);

  if (asChild && isValidElement(children)) {
    const child = Children.only(children) as ReactElement<
      HTMLAttributes<HTMLElement> & { children?: ReactNode }
    >;

    return cloneElement(
      child,
      {
        ...props,
        ...child.props,
        className: cn(classes, child.props.className),
      },
      <ButtonContent
        loading={loading}
        iconLeft={iconLeft}
        iconRight={iconRight}
        label={child.props.children}
      />,
    );
  }

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      <ButtonContent
        loading={loading}
        iconLeft={iconLeft}
        iconRight={iconRight}
        label={children}
      />
    </button>
  );
}
