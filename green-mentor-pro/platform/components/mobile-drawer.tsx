"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";

/**
 * Left-slide overlay drawer for the sub-lg chrome (hamburger nav, AI chat
 * history). Portaled to <body>: both bars that spawn drawers (the Shell header
 * and the WorkspaceFrame toolbar) use backdrop-blur, which makes them containing
 * blocks for fixed-position descendants — rendered inline, the overlay would pin
 * to the bar instead of the viewport. Modal semantics follow the feed
 * CommentsSheet; entry animates, close unmounts instantly so onClose stays
 * synchronous for scrim / Esc / link taps. Callers conditionally mount:
 * `{open && <MobileDrawer …>}`.
 */
export function MobileDrawer({
  label,
  onClose,
  panelClassName,
  children,
}: {
  label: string;
  onClose: () => void;
  panelClassName?: string;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Slide in on mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Modal dialog semantics: move focus into the panel, trap Tab, Esc to close,
  // lock background scroll, and restore focus to the trigger on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();

    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label={label}>
      <div
        onClick={onClose}
        className={clsx(
          "absolute inset-0 bg-black/30 transition-opacity duration-200",
          show ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={clsx(
          "absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col pb-[env(safe-area-inset-bottom)] shadow-lift outline-none transition-transform duration-[240ms] ease-out",
          show ? "translate-x-0" : "-translate-x-full",
          panelClassName
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
