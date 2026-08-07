"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

interface AdminPanelContextValue {
  isPanel: boolean;
  setDirty: (dirty: boolean) => void;
  close: () => void;
}

const AdminPanelContext = createContext<AdminPanelContextValue>({
  isPanel: false,
  setDirty: () => undefined,
  close: () => undefined,
});

export function useAdminPanel() {
  return useContext(AdminPanelContext);
}

interface AdminEditPanelProps {
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
  title: string;
  size?: "standard" | "wide";
  dirty?: boolean;
}

/** Light-theme responsive editor shell: right rail on desktop, full width on mobile. */
export function AdminEditPanel({ children, open, onClose, title, size = "standard", dirty: dirtyProp }: AdminEditPanelProps) {
  const [internalDirty, setInternalDirty] = useState(false);
  const dirty = dirtyProp ?? internalDirty;
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const closeIfAllowed = useCallback(() => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    onClose();
  }, [dirty, onClose]);

  const context = useMemo(
    () => ({ isPanel: true, setDirty: setInternalDirty, close: closeIfAllowed }),
    [closeIfAllowed],
  );

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => previousFocus.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeIfAllowed();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeIfAllowed, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-ink/20"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) closeIfAllowed();
      }}
    >
      <div
        ref={panelRef}
        className={[
          "relative flex h-full w-full flex-col overflow-y-auto bg-white shadow-lift",
          size === "wide" ? "max-w-4xl" : "max-w-2xl",
        ].join(" ")}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/95 px-5 py-4 backdrop-blur">
          <h2 className="pr-10 text-[15px] font-semibold text-ink">{title}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={closeIfAllowed}
            className="absolute right-4 top-3 rounded-lg border border-gray-200 px-2.5 py-1 text-lg leading-none text-gray-500 hover:bg-gray-50 hover:text-ink"
            aria-label="Close panel"
          >
            ×
          </button>
        </div>
        <AdminPanelContext.Provider value={context}>
          <div className="flex-1 p-5">{children}</div>
        </AdminPanelContext.Provider>
      </div>
    </div>
  );
}
