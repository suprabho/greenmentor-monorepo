import { useOnboarding } from "@/lib/store/onboarding";

export type OnboardingStep =
  | "welcome"
  | "audience"
  | "goals"
  | "plan"
  | "checkout"
  | "handoff";

/**
 * Best-effort upsert of the current onboarding state to the lead sheet,
 * keyed by leadId so each visitor maps to one row that fills in as they
 * progress — including those who drop off before paying. `status` flips to
 * "completed" once Razorpay payment is verified. No-ops until we have a
 * leadId + email (i.e. before the welcome step), and never blocks the flow
 * if the write fails.
 */
export function syncLead(step: OnboardingStep): void {
  const s = useOnboarding.getState();
  if (!s.leadId || !s.email) return;

  const payload = {
    leadId: s.leadId,
    status: s.paymentStatus === "paid" ? "completed" : "in_progress",
    step,
    name: s.name,
    email: s.email,
    segment: s.segment,
    goals: s.goals,
    planId: s.planId,
    billingCycle: s.billingCycle,
    razorpaySubscriptionId: s.razorpaySubscriptionId,
    razorpayPaymentId: s.razorpayPaymentId,
  };

  void fetch("/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    // Survive the navigation that immediately follows most step transitions.
    keepalive: true,
  }).catch(() => {
    // best-effort; the sheet is a side-record, never a gate on the flow
  });
}
