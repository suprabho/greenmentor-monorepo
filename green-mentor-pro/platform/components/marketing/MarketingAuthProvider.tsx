"use client";

import { createContext, useContext } from "react";

/**
 * Marketing-shell auth context. The marketing layout (a Server Component) reads
 * the Supabase session and feeds `isAuthed` down, so client CTAs can point a
 * signed-in visitor straight to the app instead of the login screen. Because
 * the value is resolved server-side, there's no logged-out → logged-in href
 * flash on hydration.
 */
const MarketingAuthContext = createContext<{ isAuthed: boolean }>({ isAuthed: false });

export function MarketingAuthProvider({
  isAuthed,
  children,
}: {
  isAuthed: boolean;
  children: React.ReactNode;
}) {
  return (
    <MarketingAuthContext.Provider value={{ isAuthed }}>
      {children}
    </MarketingAuthContext.Provider>
  );
}

/** Where a primary "Get started" CTA should lead for the current visitor. */
export function useCtaHref() {
  const { isAuthed } = useContext(MarketingAuthContext);
  return isAuthed ? "/feed" : "/login";
}
