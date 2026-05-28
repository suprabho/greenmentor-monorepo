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
}

export function MultiSelectChips({
  options,
  selected,
  onToggle,
}: MultiSelectChipsProps) {
  return (
    <div className="flex flex-wrap gap-3" role="group">
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onToggle(option.id)}
            aria-pressed={isSelected}
            className={cn(
              "inline-flex items-center gap-2 rounded-[14px] border px-[20px] py-[12px] text-[15px] font-semibold",
              "transition-[background-color,border-color,color,transform] duration-200",
              "active:scale-[0.98]",
              isSelected
                ? "border-green-500 bg-green-500 text-teal-900"
                : "border-gray-200 bg-white text-gray-700 hover:border-green-700 hover:text-green-700",
            )}
          >
            {isSelected ? (
              <Check size={16} weight="bold" aria-hidden />
            ) : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
