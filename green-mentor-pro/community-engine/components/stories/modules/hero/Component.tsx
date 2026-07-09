"use client";

import type { VizRenderProps } from "@vismay/viz-engine";
import type { StoryHeroConfig } from "./index";

const THEMES = {
  teal: { from: "#014A50", to: "#0B602C" },
  green: { from: "#0B602C", to: "#07D862" },
  ink: { from: "#0A0A0A", to: "#164E4F" },
} as const;

export default function StoryHeroComponent({ config }: VizRenderProps<StoryHeroConfig>) {
  const { eyebrow, title, subtitle, src, theme } = config;
  const t = THEMES[theme] ?? THEMES.teal;

  return (
    <div className="overflow-hidden rounded-xl">
      <div
        className="relative flex min-h-[220px] flex-col justify-end p-6"
        style={
          src
            ? { backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { backgroundImage: `linear-gradient(135deg, ${t.from}, ${t.to})` }
        }
      >
        {src ? (
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        ) : null}
        <div className="relative">
          {eyebrow ? (
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
              {eyebrow}
            </div>
          ) : null}
          <h1 className="text-[26px] font-bold leading-tight text-white">{title}</h1>
          {subtitle ? (
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-white/85">{subtitle}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
