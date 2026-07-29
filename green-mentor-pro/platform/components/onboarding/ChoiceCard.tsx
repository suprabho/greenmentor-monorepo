"use client";

import { Check } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";
import type { FieldTone } from "./Input";

interface ChoiceCardProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  tagline: string;
  description: string;
  icon: Icon;
  tone?: FieldTone;
}

/**
 * Single-select card used for the audience step and the matching section of
 * the profile editor. A <button aria-pressed> rather than a radio input —
 * matches how the rest of the app does selection (see esg-readiness's
 * QuestionCard).
 */
export function ChoiceCard({
  selected,
  onSelect,
  title,
  tagline,
  description,
  icon: Icon,
  tone = "dark",
}: ChoiceCardProps) {
  const dark = tone === "dark";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative w-full rounded-[20px] border p-7 text-left",
        "transition-[border-color,box-shadow,transform,background-color] duration-200",
        "hover:-translate-y-0.5 hover:shadow-lift",
        dark ? "bg-white/20" : "bg-white",
        selected
          ? cn(
              "-translate-y-0.5 border-green-700 bg-green-500 shadow-lift ring-2 ring-green-500 ring-offset-2",
              dark ? "ring-offset-teal-900" : "ring-offset-white",
            )
          : cn(dark ? "border-gray-200/20" : "border-gray-200", "hover:border-green-700"),
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={cn(
            "grid size-11 place-items-center rounded-full border-[2.5px] border-green-500",
            dark ? "bg-white/20" : "bg-green-50",
          )}
        >
          <Icon
            size={20}
            weight="duotone"
            className={cn(selected ? "text-teal-900" : dark ? "text-green-500" : "text-green-700")}
            aria-hidden
          />
        </div>
        <div
          className={cn(
            "grid size-6 place-items-center rounded-full border-2 transition-colors",
            selected ? "border-green-700 bg-green-500" : "border-gray-300 bg-white",
          )}
        >
          {selected ? <Check size={14} weight="bold" className="text-white" /> : null}
        </div>
      </div>

      <div className="mt-6 space-y-1">
        <h3
          className={cn(
            "text-[20px] font-bold leading-tight",
            selected ? "text-teal-900" : dark ? "text-white" : "text-ink",
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "text-[14px] font-medium",
            selected ? "text-teal-900" : dark ? "text-green-500" : "text-green-700",
          )}
        >
          {tagline}
        </p>
      </div>
      <p
        className={cn(
          "mt-3 text-[15px] leading-relaxed",
          selected ? "text-teal-900/80" : dark ? "text-white/70" : "text-gray-600",
        )}
      >
        {description}
      </p>
    </button>
  );
}
