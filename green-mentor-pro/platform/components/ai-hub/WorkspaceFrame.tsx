"use client";

/**
 * Full-bleed, full-height frame for the /ai-hub Claude-style workspace.
 *
 * The app Shell (`components/shell.tsx`) wraps every (app) route in a `main` with
 * `px-4 py-6 pb-24 lg:px-8 lg:pb-10` under a sticky `h-14` (3.5rem) header. A
 * three-column workspace needs the whole viewport, so we cancel that padding with
 * negative margins and pin to `100dvh - header`. This mirrors the escape hatch
 * `app/(app)/buddy/page.tsx` already uses (`calc(100vh - 7rem)`), extended to go
 * edge-to-edge horizontally.
 *
 * Each child page owns its own scrolling (`h-full overflow-y-auto` or a column
 * grid); the body slot is `min-h-0 flex-1 overflow-hidden`. On mobile the Shell's
 * fixed bottom nav overlays the bottom, so the body reserves space for it.
 */
export function WorkspaceFrame({
  toolbar,
  children,
}: {
  toolbar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-6 -mb-24 flex h-[calc(100dvh-7rem)] flex-col overflow-hidden bg-gray-50 lg:-mx-8 lg:-mb-10 lg:h-[calc(100dvh-3.5rem)]">
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 py-2.5 backdrop-blur lg:px-6">
        {toolbar}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
