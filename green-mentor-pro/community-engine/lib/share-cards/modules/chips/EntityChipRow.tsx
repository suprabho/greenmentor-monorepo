"use client";

import type { CSSProperties } from "react";
import type { ShareCardEntity } from "../../types";

export type ChipTone = "glass" | "solid" | "outline";

function chipStyle(tone: ChipTone): CSSProperties {
  switch (tone) {
    case "solid":
      return { background: "var(--gmcard-accent)", color: "rgba(0,0,0,0.78)" };
    case "outline":
      return {
        border: "1.5px solid var(--gmcard-accent)",
        color: "var(--gmcard-text)",
        background: "transparent",
      };
    default:
      return {
        background: "rgba(127,127,127,0.18)",
        color: "var(--gmcard-text)",
        backdropFilter: "blur(4px)",
      };
  }
}

/** The entity tag pills (framework / topic / region / company) — shared by the
 *  article card's footer and the standalone gmcard:entity-chips layer. */
export function EntityChipRow({
  entities,
  max,
  tone,
}: {
  entities: ShareCardEntity[];
  max: number;
  tone: ChipTone;
}) {
  const shown = entities.slice(0, Math.max(1, max));
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((e) => (
        <span
          key={e.slug}
          className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
          style={chipStyle(tone)}
        >
          {e.name}
        </span>
      ))}
    </div>
  );
}
