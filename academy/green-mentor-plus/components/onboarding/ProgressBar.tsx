"use client";

import { motion } from "framer-motion";

interface ProgressBarProps {
  step: number;
  total: number;
}

export function ProgressBar({ step, total }: ProgressBarProps) {
  const percent = Math.min(100, Math.round((step / total) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[13px]">
        <span className="gm-eyebrow text-green-700">
          Step {step} of {total}
        </span>
        <span className="text-gray-500">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1 w-full overflow-hidden rounded-full bg-gray-200"
      >
        <motion.div
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
          className="h-full rounded-full bg-green-500"
        />
      </div>
    </div>
  );
}
