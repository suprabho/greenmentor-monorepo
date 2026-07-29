import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * `dark` sits on the teal onboarding shell (white labels); `light` sits inside
 * a white Card on /profile. Only the label/hint colours differ — the control
 * itself is white-on-both.
 */
export type FieldTone = "dark" | "light";

export const labelCls = (tone: FieldTone) =>
  cn("text-[14px] font-semibold", tone === "dark" ? "text-white" : "text-ink");

export const hintCls = (tone: FieldTone) =>
  cn("text-[14px]", tone === "dark" ? "text-white/60" : "text-gray-500");

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  iconLeft?: ReactNode;
  tone?: FieldTone;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, iconLeft, tone = "dark", className, id, ...props },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="grid gap-2">
      {label ? (
        <label htmlFor={inputId} className={labelCls(tone)}>
          {label}
        </label>
      ) : null}

      <div className="relative">
        {iconLeft ? (
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-500">
            {iconLeft}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-12 w-full rounded-[8px] border border-gray-200 bg-white px-4 text-[16px] text-ink",
            "placeholder:text-gray-400",
            "transition-colors duration-200",
            "hover:border-gray-600",
            "focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/15",
            iconLeft && "pl-11",
            error && "border-danger focus:border-danger focus:ring-danger/20",
            className,
          )}
          {...props}
        />
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="text-[14px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className={hintCls(tone)}>
          {hint}
        </p>
      ) : null}
    </div>
  );
});
