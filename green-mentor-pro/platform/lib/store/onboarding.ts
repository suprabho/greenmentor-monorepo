import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Slimmed from green-mentor-plus's onboarding store — keeps the funnel state
// (audience → goals → plan + billing cycle) and drops the Razorpay/lead-sync
// legs (checkout is stubbed in this build).
export type AudienceSegment = "student" | "mid-career" | "business-leader";
export type BillingCycle = "monthly" | "annual";

export interface OnboardingState {
  segment: AudienceSegment | null;
  goals: string[];
  planId: string | null;
  billingCycle: BillingCycle;
  setSegment: (s: AudienceSegment) => void;
  toggleGoal: (id: string) => void;
  setPlan: (id: string) => void;
  setBillingCycle: (c: BillingCycle) => void;
  reset: () => void;
}

const initial = {
  segment: null as AudienceSegment | null,
  goals: [] as string[],
  planId: null as string | null,
  billingCycle: "annual" as BillingCycle,
};

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initial,
      setSegment: (segment) => set({ segment }),
      toggleGoal: (id) =>
        set((s) => ({
          goals: s.goals.includes(id) ? s.goals.filter((g) => g !== id) : [...s.goals, id],
        })),
      setPlan: (planId) => set({ planId }),
      setBillingCycle: (billingCycle) => set({ billingCycle }),
      reset: () => set({ ...initial }),
    }),
    { name: "gm-onboarding", storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);
