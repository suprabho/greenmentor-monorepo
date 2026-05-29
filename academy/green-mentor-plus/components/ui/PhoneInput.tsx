import { cn } from "@/lib/utils/cn";
import { useId, type InputHTMLAttributes } from "react";
import {
  COUNTRIES,
  countryByIso,
  flagEmoji,
  DEFAULT_COUNTRY_ISO,
} from "@/lib/data/country-codes";

interface PhoneInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  label?: string;
  hint?: string;
  error?: string;
  /** National number (digits only, no country code). */
  value: string;
  onChange: (value: string) => void;
  /** Selected country ISO-3166 alpha-2 code. */
  countryIso: string;
  onCountryChange: (iso: string) => void;
}

/**
 * Phone field with a leading country-code dropdown. The dropdown's default is
 * driven by the parent (which detects it from the visitor's IP); the text
 * field holds the national number only — combine with the dial code at submit.
 */
export function PhoneInput({
  label,
  hint,
  error,
  value,
  onChange,
  countryIso,
  onCountryChange,
  className,
  id,
  ...props
}: PhoneInputProps) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  const selected = countryByIso(countryIso) ?? countryByIso(DEFAULT_COUNTRY_ISO)!;

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

      <div
        className={cn(
          "flex h-12 w-full items-stretch overflow-hidden rounded-[8px] border border-gray-200 bg-white text-[16px] text-ink",
          "transition-colors duration-200",
          "focus-within:border-green-700 focus-within:ring-2 focus-within:ring-green-700/15",
          "hover:border-gray-600",
          error &&
            "border-danger focus-within:border-danger focus-within:ring-danger/20",
          className,
        )}
      >
        <div className="relative flex items-center border-r border-gray-200">
          <span
            aria-hidden
            className="pointer-events-none flex items-center gap-1.5 pl-4 pr-7 text-ink"
          >
            <span className="text-[18px] leading-none">
              {flagEmoji(selected.iso)}
            </span>
            <span className="tabular-nums">{selected.dial}</span>
            <svg
              className="text-gray-400 absolute right-2 h-4 w-4"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="m6 8 4 4 4-4" strokeLinecap="round" />
            </svg>
          </span>
          <select
            aria-label="Country code"
            value={selected.iso}
            onChange={(e) => onCountryChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          >
            {COUNTRIES.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.name} ({c.dial})
              </option>
            ))}
          </select>
        </div>

        <input
          id={inputId}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          value={value}
          // Keep digits, spaces and dashes; strip anything else as they type.
          onChange={(e) => onChange(e.target.value.replace(/[^\d\s-]/g, ""))}
          className="h-full min-w-0 flex-1 bg-transparent px-4 text-ink placeholder:text-gray-400 focus:outline-none"
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
}
