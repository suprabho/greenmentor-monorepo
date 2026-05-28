import { cn } from "@/lib/utils/cn";
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  iconLeft?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, iconLeft, className, id, ...props },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <div className="grid gap-2">
      {label ? (
        <label
          htmlFor={inputId}
          className="text-[14px] font-semibold text-white"
        >
          {label}
        </label>
      ) : null}

      <div className="relative">
        {iconLeft ? (
          <span className="text-gray-500 pointer-events-none absolute inset-y-0 left-4 flex items-center">
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
        <p id={`${inputId}-hint`} className="text-[14px] text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
