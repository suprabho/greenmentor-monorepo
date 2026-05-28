import { cn } from "@/lib/utils/cn";

interface Stat {
  number: string;
  caption: string;
}

interface StatBandProps {
  stats: Stat[];
  className?: string;
}

/**
 * The deck's most distinctive device — a full-bleed band with the vertical
 * teal-to-neon gradient and stat numerals in Codec Pro (substituted with
 * Inter at scale). Use sparingly: once per page, max.
 */
export function StatBand({ stats, className }: StatBandProps) {
  return (
    <div
      className={cn(
        "bg-stat-band rounded-[8px] p-8 text-white md:p-12",
        className,
      )}
    >
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.caption}>
            <div className="font-numeral text-[48px] leading-none md:text-[64px]">
              {stat.number}
            </div>
            <div className="mt-2 text-[16px] text-green-100">
              {stat.caption}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
