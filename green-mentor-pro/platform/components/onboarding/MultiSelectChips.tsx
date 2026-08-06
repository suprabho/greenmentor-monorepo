"use client";

import { Check } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils/cn";

export interface ChipOption {
  id: string;
  label: string;
}

interface MultiSelectChipsProps {
  options: ChipOption[];
  selected: string[];
  onToggle: (id: string) => void;
  /** Cap on how many can be picked. At the cap, unselected chips go inert. */
  max?: number;
}

/**
 * Goal picker. The chips are white/green in both states, so this reads
 * correctly on the dark onboarding shell and inside a white Card on /profile —
 * no tone prop needed.
 *
 * Once `max` is reached the remaining chips are disabled rather than hidden:
 * the full set of options stays legible, and swapping still works because a
 * selected chip is never disabled.
 */
export function MultiSelectChips({ options, selected, onToggle, max }: MultiSelectChipsProps) {
  const atCap = max !== undefined && selected.length >= max;
  return (
    <div className="flex flex-wrap gap-3" role="group">
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        const isDisabled = atCap && !isSelected;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onToggle(option.id)}
            disabled={isDisabled}
            aria-pressed={isSelected}
            className={cn(
              "inline-flex items-center gap-2 rounded-[14px] border px-[20px] py-[12px] text-[15px] font-semibold",
              "transition-[background-color,border-color,color,transform,opacity] duration-200",
              isSelected
                ? "border-green-500 bg-green-500 text-teal-900 active:scale-[0.98]"
                : isDisabled
                  ? "cursor-not-allowed border-gray-200 bg-white text-gray-700 opacity-40"
                  : "border-gray-200 bg-white text-gray-700 hover:border-green-700 hover:text-green-700 active:scale-[0.98]",
            )}
          >
            {isSelected ? <Check size={16} weight="bold" aria-hidden /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
