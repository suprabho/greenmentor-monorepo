"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { cn } from "@/lib/utils/cn";
import {
  COUNTRIES,
  countryByIso,
  flagEmoji,
  DEFAULT_COUNTRY_ISO,
  type Country,
} from "@/lib/data/country-codes";
import { labelCls, hintCls, type FieldTone } from "./Input";

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
  tone?: FieldTone;
}

/** The picker lists countries A→Z regardless of the data file's order. */
const SORTED_COUNTRIES: Country[] = [...COUNTRIES].sort((a, b) =>
  a.name.localeCompare(b.name),
);

/**
 * Rank a country against a search query; lower ranks first, -1 means no match.
 * A digit query (with or without a leading +) searches dial codes, anything
 * else searches names and ISO codes — better hits (exact / prefix) sort ahead
 * of mere substring hits.
 */
function matchRank(c: Country, q: string): number {
  const digits = q.replace(/^\+/, "");
  if (/^\d+$/.test(digits)) {
    const dial = c.dial.slice(1);
    if (dial === digits) return 0;
    if (dial.startsWith(digits)) return 1;
    if (dial.includes(digits)) return 2;
    return -1;
  }
  const name = c.name.toLowerCase();
  if (c.iso.toLowerCase() === q) return 0;
  if (name.startsWith(q)) return 0;
  if (name.split(/\s+/).some((w) => w.startsWith(q))) return 1;
  if (name.includes(q)) return 2;
  return -1;
}

function filterCountries(query: string): Country[] {
  const q = query.trim().toLowerCase();
  if (!q) return SORTED_COUNTRIES;
  return SORTED_COUNTRIES.map((c) => ({ c, rank: matchRank(c, q) }))
    .filter(({ rank }) => rank >= 0)
    // Stable sort keeps the alphabetical order within each rank.
    .sort((a, b) => a.rank - b.rank)
    .map(({ c }) => c);
}

/**
 * Phone field with a leading country-code dropdown. The text field holds the
 * national number only — combine it with the dial code at submit via
 * `toE164()` in lib/utils/validation.
 *
 * The dropdown is a custom listbox rather than a native <select> so it can
 * offer type-to-search: the panel opens with a filter field that matches
 * country names ("uni") and dial codes ("971" or "+971") alike, with the full
 * list sorted alphabetically. Arrow keys move the highlight, Enter picks,
 * Escape closes without touching the surrounding dialog.
 */
export function PhoneInput({
  label,
  hint,
  error,
  value,
  onChange,
  countryIso,
  onCountryChange,
  tone = "dark",
  className,
  id,
  ...props
}: PhoneInputProps) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const listboxId = `${inputId}-countries`;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  const selected = countryByIso(countryIso) ?? countryByIso(DEFAULT_COUNTRY_ISO)!;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => filterCountries(query), [query]);

  const openPicker = () => {
    setQuery("");
    // Start the highlight on the current pick so Enter is a no-op re-confirm.
    const idx = SORTED_COUNTRIES.findIndex((c) => c.iso === selected.iso);
    setHighlight(idx >= 0 ? idx : 0);
    setOpen(true);
  };

  const choose = (iso: string) => {
    onCountryChange(iso);
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // Close on any press outside the picker (trigger + panel).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the highlighted row in view while arrowing through the list.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector('[data-highlighted="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  const onPanelKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") {
      // Swallow it: dialogs hosting this field close on window Escape, and a
      // press meant for the dropdown shouldn't take the whole form with it.
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = filtered[highlight];
      if (pick) choose(pick.iso);
    }
  };

  const highlighted = filtered[highlight];

  return (
    <div className="grid gap-2">
      {label ? (
        <label htmlFor={inputId} className={labelCls(tone)}>
          {label}
        </label>
      ) : null}

      <div ref={pickerRef} className="relative">
        <div
          className={cn(
            "flex h-12 w-full items-stretch overflow-hidden rounded-[8px] border border-gray-200 bg-white text-[16px] text-ink",
            "transition-colors duration-200",
            "focus-within:border-green-700 focus-within:ring-2 focus-within:ring-green-700/15",
            "hover:border-gray-600",
            error && "border-danger focus-within:border-danger focus-within:ring-danger/20",
            className,
          )}
        >
          <button
            ref={triggerRef}
            type="button"
            aria-label={`Country code: ${selected.name} ${selected.dial}`}
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => (open ? setOpen(false) : openPicker())}
            className="relative flex cursor-pointer items-center gap-1.5 border-r border-gray-200 pl-4 pr-8 text-ink focus:outline-none"
          >
            <span className="text-[18px] leading-none">{flagEmoji(selected.iso)}</span>
            <span className="tabular-nums">{selected.dial}</span>
            <svg
              aria-hidden
              className={cn(
                "absolute right-2 h-4 w-4 text-gray-400 transition-transform duration-150",
                open && "rotate-180",
              )}
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="m6 8 4 4 4-4" strokeLinecap="round" />
            </svg>
          </button>

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

        {open && (
          <div
            onKeyDown={onPanelKeyDown}
            className="absolute left-0 top-[calc(100%+4px)] z-30 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[8px] border border-gray-200 bg-white shadow-lg"
          >
            <div className="border-b border-gray-100 p-2">
              <input
                ref={searchRef}
                role="combobox"
                aria-expanded
                aria-controls={listboxId}
                aria-activedescendant={highlighted ? `${listboxId}-${highlighted.iso}` : undefined}
                aria-label="Search countries"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                placeholder="Search country or code"
                className="h-9 w-full rounded-[6px] border border-gray-200 bg-white px-3 text-[14px] text-ink placeholder:text-gray-400 focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/15"
              />
            </div>
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label="Country code"
              className="max-h-56 overflow-y-auto py-1"
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-[13.5px] text-gray-500">No matching countries</li>
              ) : (
                filtered.map((c, i) => (
                  <li
                    key={c.iso}
                    id={`${listboxId}-${c.iso}`}
                    role="option"
                    aria-selected={c.iso === selected.iso}
                    data-highlighted={i === highlight}
                    // preventDefault keeps focus on the search field so a
                    // click doesn't blur-close the panel before it lands.
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => choose(c.iso)}
                    onPointerMove={() => setHighlight(i)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[14px] text-ink",
                      i === highlight && "bg-gray-100",
                      c.iso === selected.iso && "font-semibold",
                    )}
                  >
                    <span className="text-[16px] leading-none">{flagEmoji(c.iso)}</span>
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="tabular-nums text-[13px] text-gray-500">{c.dial}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
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
}
