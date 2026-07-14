// Minimal form primitives for the ESG data-entry surfaces. The platform's
// components/ui.tsx has display primitives (Card, Chip, Stat…) but no form
// controls, and the Energy forms carry ~12 fields each — so these live here,
// styled with the same Tailwind-v4 tokens (ink / gray / teal / green).
"use client";

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function Field({
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={twMerge("block", className)}>
      <span className="mb-1 block text-[12px] font-semibold text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-gray-500">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] font-medium text-danger">{error}</span>}
    </label>
  );
}

const controlCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13.5px] text-ink outline-none transition-colors placeholder:text-gray-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={twMerge(controlCls, className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={twMerge(controlCls, "appearance-none pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={twMerge(controlCls, "min-h-20 resize-y", className)} {...props} />;
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const variants = {
    primary: "bg-teal-900 text-white hover:bg-teal-800 disabled:bg-gray-300",
    secondary: "border border-gray-200 bg-white text-ink hover:bg-gray-50",
    ghost: "text-gray-600 hover:bg-gray-100 hover:text-ink",
    danger: "bg-danger text-white hover:opacity-90",
  };
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

/** Simple scroll-wrapped table (no generic data-table dep in the platform). */
export function Table({
  head,
  children,
  empty,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">
            {head}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && (
        <div className="py-10 text-center text-[13px] text-gray-500">No entries yet.</div>
      )}
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={twMerge("whitespace-nowrap px-3 py-2.5 font-semibold", className)}>{children}</th>;
}

export function Td({
  children,
  className,
  title,
}: {
  children?: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <td title={title} className={twMerge("whitespace-nowrap px-3 py-2.5 text-gray-700", className)}>
      {children}
    </td>
  );
}
