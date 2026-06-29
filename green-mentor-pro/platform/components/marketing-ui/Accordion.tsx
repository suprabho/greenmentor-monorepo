"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils/cn";
import { track } from "@/lib/utils/analytics";

export interface AccordionItem {
  id: string;
  question: string;
  answer: string;
}

interface AccordionProps {
  items: AccordionItem[];
  multiple?: boolean;
  className?: string;
}

export function Accordion({
  items,
  multiple = false,
  className,
}: AccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(multiple ? prev : []);
      if (prev.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        track("faq_opened", { id });
      }
      return next;
    });
  }

  return (
    <div className={cn("divide-y divide-gray-200", className)}>
      {items.map((item) => {
        const isOpen = openIds.has(item.id);
        return (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => toggle(item.id)}
              aria-expanded={isOpen}
              aria-controls={`panel-${item.id}`}
              className={cn(
                "flex w-full items-center justify-between gap-6 py-6 text-left",
                "text-ink hover:text-green-700 transition-colors",
              )}
            >
              <span className="text-[20px] font-semibold leading-snug">
                {item.question}
              </span>
              <span
                aria-hidden
                className={cn(
                  "shrink-0 grid place-items-center size-9 rounded-full border transition-colors",
                  isOpen
                    ? "border-green-700 bg-green-700 text-white"
                    : "border-gray-200 text-gray-700",
                )}
              >
                {isOpen ? <Minus size={16} weight="bold" /> : <Plus size={16} weight="bold" />}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  key="content"
                  id={`panel-${item.id}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <p className="pb-6 text-gray-700 leading-relaxed text-[18px] max-w-2xl">
                    {item.answer}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
