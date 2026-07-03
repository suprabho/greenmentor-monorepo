import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={twMerge("rounded-[10px] border border-gray-200 bg-white shadow-soft", className)}>
      {children}
    </div>
  );
}

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "teal" | "warn" | "danger";
  className?: string;
}) {
  const tones = {
    neutral: "bg-gray-100 text-gray-700",
    green: "bg-green-50 text-green-700",
    teal: "bg-teal-900 text-green-100",
    warn: "bg-[#FFF4E0] text-[#B25E00]",
    danger: "bg-red-50 text-danger",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-[11.5px] font-semibold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({
  src,
  name,
  size = 28,
  className,
}: {
  src?: string;
  name: string;
  size?: number;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className={clsx("shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      className={clsx(
        "grid shrink-0 place-items-center rounded-full bg-green-100 font-bold text-teal-800",
        className
      )}
    >
      {name[0]}
    </span>
  );
}

export function AvatarStack({
  srcs,
  size = 24,
  className,
}: {
  srcs: string[];
  size?: number;
  className?: string;
}) {
  return (
    <span className={clsx("flex -space-x-2", className)}>
      {srcs.map((s) => (
        <Avatar key={s} src={s} name="" size={size} className="ring-2 ring-white" />
      ))}
    </span>
  );
}

export function PageHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-[13.5px] text-gray-700">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={clsx("h-1.5 w-full overflow-hidden rounded-pill bg-gray-100", className)}>
      <div className="h-full rounded-pill bg-green-500" style={{ width: `${value}%` }} />
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</div>
      <div className="mt-1 text-[24px] font-semibold tracking-tight text-ink">{value}</div>
      {sub && <div className="text-[12px] text-gray-600">{sub}</div>}
    </div>
  );
}
