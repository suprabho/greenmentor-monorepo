"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
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

/** Lowercase and strip diacritics so "reunion" finds "Réunion". */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

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
  const name = fold(c.name);
  if (c.iso.toLowerCase() === q) return 0;
  if (name.startsWith(q)) return 0;
  if (name.split(/\s+/).some((w) => w.startsWith(q))) return 1;
  if (name.includes(q)) return 2;
  return -1;
}

/**
 * Where and how big the dropdown panel is, in layout-viewport coordinates.
 * The panel is `position: fixed` so the host dialog's overflow can't clip it;
 * `up` flips it above the field when the space below is tighter (a soft
 * keyboard eating the bottom half of the screen is the common cause), and
 * `maxList` squeezes the list to whatever actually fits.
 */
interface PanelPos {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
  maxList: number;
}

function filterCountries(query: string): Country[] {
  const q = fold(query.trim());
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
 * Escape closes without touching the surrounding dialog. The panel itself is
 * fixed-positioned and sized against the visual viewport (see PanelPos), so
 * it stays visible inside scrollable dialogs and above soft keyboards.
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
  const [panel, setPanel] = useState<PanelPos | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => filterCountries(query), [query]);

  /**
   * Anchor the panel to the field within the *visual* viewport — the part of
   * the page the soft keyboard hasn't covered. Re-run on every viewport
   * resize/scroll while open, so the panel flips or shrinks as the keyboard
   * comes and goes.
   */
  const positionPanel = useCallback(() => {
    const anchor = controlRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const vv = window.visualViewport;
    const vpTop = vv?.offsetTop ?? 0;
    const vpLeft = vv?.offsetLeft ?? 0;
    const vpW = vv?.width ?? window.innerWidth;
    const vpH = vv?.height ?? window.innerHeight;
    const margin = 8;
    const gap = 4;
    const searchH = 54; // search row height incl. padding and borders
    const idealList = 224; // matches the old max-h-56

    const width = Math.min(288, vpW - margin * 2);
    const left = Math.min(Math.max(rect.left, vpLeft + margin), vpLeft + vpW - width - margin);
    const below = vpTop + vpH - rect.bottom - gap - margin;
    const above = rect.top - vpTop - gap - margin;
    const up = below < searchH + 120 && above > below;
    const maxList = Math.max(90, Math.min(idealList, (up ? above : below) - searchH));

    setPanel({
      left,
      width,
      maxList,
      top: up ? undefined : rect.bottom + gap,
      bottom: up ? window.innerHeight - rect.top + gap : undefined,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanel(null);
      return;
    }
    positionPanel();
    const vv = window.visualViewport;
    window.addEventListener("resize", positionPanel);
    // Capture-phase so scrolls inside a host dialog's scroll container count.
    window.addEventListener("scroll", positionPanel, true);
    vv?.addEventListener("resize", positionPanel);
    vv?.addEventListener("scroll", positionPanel);
    return () => {
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
      vv?.removeEventListener("resize", positionPanel);
      vv?.removeEventListener("scroll", positionPanel);
    };
  }, [open, positionPanel]);

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

  // The panel mounts one commit after `open` (once positionPanel has run),
  // so focus once when it first appears rather than on the open flip.
  const focusedOnOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      focusedOnOpen.current = false;
      return;
    }
    if (focusedOnOpen.current || !panel) return;
    focusedOnOpen.current = true;
    // On touch devices focusing the search field would summon the keyboard
    // and eat half the viewport before the list is even seen — let the user
    // opt into typing by tapping the field instead.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    searchRef.current?.focus();
  }, [open, panel]);

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

  const onPickerKeyDown = (e: ReactKeyboardEvent) => {
    if (!open) return;
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

      {/* Key handler covers the trigger too, so Escape/arrows work before
          focus moves into the panel. min-w-0: as a grid item this would
          otherwise size the track to the row's intrinsic width (the text
          input's size attribute plus the dial chip), overflowing narrow
          containers instead of letting flexbox shrink the input. */}
      <div ref={pickerRef} className="relative min-w-0" onKeyDown={onPickerKeyDown}>
        <div
          ref={controlRef}
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
            className="relative flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-gray-200 pl-4 pr-8 text-ink focus:outline-none"
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

        {open && panel && (
          <div
            style={{
              left: panel.left,
              top: panel.top,
              bottom: panel.bottom,
              width: panel.width,
            }}
            className="fixed z-[60] overflow-hidden rounded-[8px] border border-gray-200 bg-white shadow-lg"
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
                // 16px on touch widths: mobile browsers auto-zoom the page
                // when a focused input's font is smaller, which leaves the
                // whole dialog cropped and horizontally scrollable.
                className="h-9 w-full rounded-[6px] border border-gray-200 bg-white px-3 text-[16px] text-ink placeholder:text-gray-400 focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/15 sm:text-[14px]"
              />
            </div>
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label="Country code"
              style={{ maxHeight: panel.maxList }}
              className="overflow-y-auto py-1"
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
