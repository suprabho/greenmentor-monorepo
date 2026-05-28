/**
 * Razorpay integration constants.
 *
 * Razorpay is the *payment* seam — it sits between the plan-select step and
 * the existing Learnyst handoff. Learnyst still owns auth + courses.
 *
 * Required env vars (see `.env.example`):
 *  - RAZORPAY_KEY_ID            — server + client (mirrored as NEXT_PUBLIC_…)
 *  - RAZORPAY_KEY_SECRET        — server only, never exposed
 *  - RAZORPAY_WEBHOOK_SECRET    — server only, used to verify webhook payloads
 *  - RAZORPAY_PLAN_<PLAN>_<CYCLE> — one per (planId × billingCycle), created
 *    in the Razorpay dashboard. PLAN ∈ {MEMBERSHIP} (single tier — see
 *    lib/data/plans.ts), CYCLE ∈ {MONTHLY, ANNUAL}.
 *
 * TODO[Razorpay]: create the four plans in the Razorpay dashboard and drop the
 * ids into `.env.local`. Without them, the create-subscription endpoint
 * returns 500 with a clear "plan not configured" message in dev.
 */

import type { BillingCycle } from "@/lib/store/onboarding";

/** Max number of billing cycles to authorise on the Razorpay subscription. */
const TOTAL_COUNT_BY_CYCLE: Record<BillingCycle, number> = {
  monthly: 60, // 5 years of monthly debits — well past any realistic cancel
  annual: 5,
};

/** Server-side check; throws if a required env var is missing. */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing env var ${key}. See .env.example for the full Razorpay set.`,
    );
  }
  return value;
}

export function getRazorpayServerKeys(): { keyId: string; keySecret: string } {
  return {
    keyId: requireEnv("RAZORPAY_KEY_ID"),
    keySecret: requireEnv("RAZORPAY_KEY_SECRET"),
  };
}

export function getRazorpayWebhookSecret(): string {
  return requireEnv("RAZORPAY_WEBHOOK_SECRET");
}

/** Client-side key, safe to ship to the browser. */
export function getRazorpayPublicKeyId(): string | undefined {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
}

/**
 * Resolve a Razorpay plan id from our internal (planId, billingCycle) tuple.
 * Throws a developer-facing error if the env var hasn't been set.
 */
export function getRazorpayPlanId(
  planId: string,
  cycle: BillingCycle,
): string {
  const envKey = `RAZORPAY_PLAN_${planId.toUpperCase()}_${cycle.toUpperCase()}`;
  const value = process.env[envKey];
  if (!value) {
    throw new Error(
      `Razorpay plan id for "${planId} / ${cycle}" not configured. ` +
        `Set ${envKey} in .env.local — see .env.example.`,
    );
  }
  return value;
}

export function getTotalCountForCycle(cycle: BillingCycle): number {
  return TOTAL_COUNT_BY_CYCLE[cycle];
}
