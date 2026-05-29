import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AudienceSegment } from "@/lib/data/audiences";
import { DEFAULT_COUNTRY_ISO } from "@/lib/data/country-codes";

export type BillingCycle = "monthly" | "annual";

/**
 * Lifecycle of the Razorpay leg.
 *   idle      — no subscription created yet
 *   pending   — subscription created, awaiting checkout
 *   paid      — Razorpay signed payment verified server-side
 *   failed    — verification failed or user dismissed checkout
 */
export type PaymentStatus = "idle" | "pending" | "paid" | "failed";

export interface OnboardingState {
  // Stable per-visitor key for the lead sheet. Generated once name+email are
  // captured (welcome step) so every later sync upserts the same row.
  leadId: string | null;
  name: string;
  email: string;
  // Full phone in E.164-ish form (dial code + national number, e.g. "+919876543210")
  // and the country ISO that produced the dial code (for re-hydrating the picker).
  phone: string;
  phoneCountry: string;
  segment: AudienceSegment | null;
  goals: string[];
  planId: string | null;
  billingCycle: BillingCycle;

  // Razorpay handshake
  razorpaySubscriptionId: string | null;
  razorpayPaymentId: string | null;
  paymentStatus: PaymentStatus;

  // setters
  setIdentity: (input: {
    name: string;
    email: string;
    phone?: string;
    phoneCountry?: string;
  }) => void;
  setSegment: (segment: AudienceSegment) => void;
  toggleGoal: (id: string) => void;
  setPlan: (planId: string) => void;
  setBillingCycle: (cycle: BillingCycle) => void;
  setRazorpaySubscriptionId: (id: string | null) => void;
  setPaymentResult: (input: {
    paymentId: string;
    subscriptionId: string;
  }) => void;
  setPaymentStatus: (status: PaymentStatus) => void;
  resetPayment: () => void;
  reset: () => void;
}

const initialState = {
  leadId: null as string | null,
  name: "",
  email: "",
  phone: "",
  phoneCountry: DEFAULT_COUNTRY_ISO,
  segment: null,
  goals: [] as string[],
  planId: null,
  billingCycle: "annual" as BillingCycle,
  razorpaySubscriptionId: null,
  razorpayPaymentId: null,
  paymentStatus: "idle" as PaymentStatus,
};

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,

      setIdentity: ({ name, email, phone, phoneCountry }) =>
        set((state) => ({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone?.trim() ?? state.phone,
          phoneCountry: phoneCountry ?? state.phoneCountry,
          // Mint the lead id on first identity capture; keep it stable if the
          // user edits their details and resubmits.
          leadId: state.leadId ?? crypto.randomUUID(),
        })),

      setSegment: (segment) => set({ segment }),

      toggleGoal: (id) =>
        set((state) => ({
          goals: state.goals.includes(id)
            ? state.goals.filter((g) => g !== id)
            : [...state.goals, id],
        })),

      setPlan: (planId) =>
        // Selecting a (new) plan invalidates any in-flight Razorpay subscription —
        // we'd be charging for a different plan otherwise.
        set((state) => {
          if (state.planId === planId) return { planId };
          return {
            planId,
            razorpaySubscriptionId: null,
            razorpayPaymentId: null,
            paymentStatus: "idle",
          };
        }),

      setBillingCycle: (billingCycle) =>
        // Same reason as setPlan — billing cycle is part of the plan-id lookup.
        set((state) => {
          if (state.billingCycle === billingCycle) return { billingCycle };
          return {
            billingCycle,
            razorpaySubscriptionId: null,
            razorpayPaymentId: null,
            paymentStatus: "idle",
          };
        }),

      setRazorpaySubscriptionId: (id) =>
        set({ razorpaySubscriptionId: id, paymentStatus: "pending" }),

      setPaymentResult: ({ paymentId, subscriptionId }) =>
        set({
          razorpayPaymentId: paymentId,
          razorpaySubscriptionId: subscriptionId,
          paymentStatus: "paid",
        }),

      setPaymentStatus: (paymentStatus) => set({ paymentStatus }),

      resetPayment: () =>
        set({
          razorpaySubscriptionId: null,
          razorpayPaymentId: null,
          paymentStatus: "idle",
        }),

      reset: () => set({ ...initialState }),
    }),
    {
      name: "gm-onboarding",
      storage: createJSONStorage(() => localStorage),
      version: 3,
    },
  ),
);
