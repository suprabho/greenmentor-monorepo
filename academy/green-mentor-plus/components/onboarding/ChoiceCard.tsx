"use client";

import { Check } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";

interface ChoiceCardProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  tagline: string;
  description: string;
  icon: Icon;
}

export function ChoiceCard({
  selected,
  onSelect,
  title,
  tagline,
  description,
  icon: Icon,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative w-full rounded-[20px] border bg-white p-7 text-left",
        "transition-[border-color,box-shadow,transform,background-color] duration-200",
        "hover:-translate-y-0.5 hover:shadow-lift",
        selected
          ? "border-green-700 shadow-lift"
          : "border-gray-200 hover:border-green-700",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={cn(
            "grid size-12 place-items-center rounded-full border-[2.5px]",
            selected
              ? "border-green-500 bg-green-500"
              : "border-green-500 bg-white",
          )}
        >
          {selected ? (
            <Check size={20} weight="bold" className="text-teal-900" />
          ) : (
            <div className="size-6 rounded-full bg-green-500" />
          )}
        </div>
        <Icon size={20} weight="duotone" className="text-gray-400" aria-hidden />
      </div>

      <div className="mt-6 space-y-1">
        <h3 className="text-[20px] font-bold leading-tight text-ink">{title}</h3>
        <p className="text-[14px] font-medium text-green-700">{tagline}</p>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-gray-700">
        {description}
      </p>
    </button>
  );
}
