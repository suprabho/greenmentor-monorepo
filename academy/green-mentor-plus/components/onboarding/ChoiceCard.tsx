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
        "group relative w-full rounded-[20px] border bg-white/20 p-7 text-left",
        "transition-[border-color,box-shadow,transform,background-color] duration-200",
        "hover:-translate-y-0.5 hover:shadow-lift",
        selected
          ? "-translate-y-0.5 border-green-700 bg-green-500 shadow-lift ring-2 ring-green-500 ring-offset-2 ring-offset-teal-900"
          : "border-gray-200/20 hover:border-green-700",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="grid size-11 place-items-center rounded-full border-[2.5px] border-green-500 bg-white/20">
          <Icon
            size={20}
            weight="duotone"
            className={cn(selected ? "text-green-950" : "text-green-400")}
            aria-hidden
          />
        </div>
        <div
          className={cn(
            "grid size-6 place-items-center rounded-full border-2 transition-colors",
            selected
              ? "border-green-700 bg-green-500"
              : "border-gray-300 bg-white",
          )}
        >
          {selected ? (
            <Check size={14} weight="bold" className="text-white" />
          ) : null}
        </div>
      </div>

      <div className="mt-6 space-y-1">
        <h3
          className={cn(
            "text-[20px] font-bold leading-tight",
            selected ? "text-green-950" : "text-white",
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "text-[14px] font-medium",
            selected ? "text-green-950" : "text-green-400",
          )}
        >
          {tagline}
        </p>
      </div>
      <p
        className={cn(
          "mt-3 text-[15px] leading-relaxed",
          selected ? "text-green-950/80" : "text-white/70",
        )}
      >
        {description}
      </p>
    </button>
  );
}
