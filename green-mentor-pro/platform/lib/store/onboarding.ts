import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_COUNTRY_ISO } from "@/lib/data/country-codes";
import { MAX_GOALS } from "@/lib/onboarding/goals";

// Ported from green-mentor-plus's onboarding store — keeps identity capture
// (name + phone) and the funnel state (audience → goals), and drops the
// Razorpay/lead-sync legs. The plan/billing step is deferred for now, so this
// no longer tracks it either.
//
// Unlike the source, each step also writes through to PATCH /api/profile, so
// this store is a draft cache for the in-flight wizard rather than the only
// copy of the answers.
export type AudienceSegment = "student" | "mid-career" | "business-leader";

export interface OnboardingState {
  displayName: string;
  /** National number as typed (digits/spaces/dashes) — joined to E.164 at save. */
  phone: string;
  /** ISO-3166 alpha-2 backing the dial code, for re-hydrating the picker. */
  phoneCountry: string;
  segment: AudienceSegment | null;
  goals: string[];
  /** Where to land once the wizard finishes — set from `?next=` when someone
   *  arrives here mid-flight from a shared link. Null means /home. */
  nextHref: string | null;

  setIdentity: (input: { displayName: string; phone: string; phoneCountry: string }) => void;
  setSegment: (s: AudienceSegment) => void;
  toggleGoal: (id: string) => void;
  setNextHref: (href: string | null) => void;
  /** Seed the draft from the profile row so a resumed flow shows prior answers. */
  hydrateFrom: (input: Partial<Omit<OnboardingState, keyof OnboardingActions>>) => void;
  reset: () => void;
}

type OnboardingActions = Pick<
  OnboardingState,
  "setIdentity" | "setSegment" | "toggleGoal" | "setNextHref" | "hydrateFrom" | "reset"
>;

const initial = {
  displayName: "",
  phone: "",
  phoneCountry: DEFAULT_COUNTRY_ISO,
  segment: null as AudienceSegment | null,
  goals: [] as string[],
  nextHref: null as string | null,
};

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initial,

      setIdentity: ({ displayName, phone, phoneCountry }) =>
        set({ displayName: displayName.trim(), phone: phone.trim(), phoneCountry }),

      setSegment: (segment) => set({ segment }),

      // Deselect always works; an add past MAX_GOALS is a no-op so the store
      // can never hold a selection the API would reject. The picker disables
      // those chips anyway — this is the belt to that pair of braces.
      toggleGoal: (id) =>
        set((s) => {
          if (s.goals.includes(id)) return { goals: s.goals.filter((g) => g !== id) };
          if (s.goals.length >= MAX_GOALS) return {};
          return { goals: [...s.goals, id] };
        }),

      setNextHref: (nextHref) => set({ nextHref }),

      // Only fill blanks — never clobber an answer the user just changed but
      // hasn't saved yet (the server copy would be one step behind).
      hydrateFrom: (input) =>
        set((s) => ({
          displayName: s.displayName || input.displayName || "",
          phone: s.phone || input.phone || "",
          phoneCountry: s.phone ? s.phoneCountry : (input.phoneCountry ?? s.phoneCountry),
          segment: s.segment ?? input.segment ?? null,
          // Trim on the way in: a profile saved before the cap existed can hold
          // more than MAX_GOALS, and seeding those would leave the wizard over
          // the limit with no way to continue.
          goals: s.goals.length > 0 ? s.goals : (input.goals ?? []).slice(0, MAX_GOALS),
        })),

      reset: () => set({ ...initial }),
    }),
    {
      // Deliberately not "gm-onboarding" — green-mentor-plus persists a
      // different shape under that key at version 3.
      name: "gm-pro-onboarding",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

/**
 * Resolves once the persisted draft has been read back from localStorage.
 * Guards that read store state must wait for this, or they run against the
 * initial values and bounce on first paint.
 */
export function useOnboardingHydrated(): boolean {
  // Always start false so the server render and the first client render agree.
  // The effect below only runs in the browser, which is the only place the
  // persisted draft exists anyway.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // `persist` is absent when zustand couldn't build a storage — createJSONStorage
    // returns undefined if touching localStorage throws. Nothing to wait for then.
    const store = useOnboarding.persist;
    if (!store) {
      setHydrated(true);
      return;
    }
    if (store.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return store.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}
