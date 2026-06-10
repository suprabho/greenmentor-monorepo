"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  CheckCircle,
  CircleNotch,
  Lock,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { useOnboarding } from "@/lib/store/onboarding";
import { plans, flatDiscount, discountedPrice } from "@/lib/data/plans";
import { useRazorpayCheckout } from "@/lib/razorpay/useRazorpayCheckout";
import { BottomNav } from "@/components/onboarding/BottomNav";

function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

// The plan step opens the Razorpay modal in place, so in the normal flow this
// page is never visited. It stays as the target for deep links and the
// handoff guard (paymentStatus !== "paid" redirects here): it auto-starts the
// same useRazorpayCheckout lifecycle and renders a status around the modal.
export default function CheckoutStep() {
  const router = useRouter();
  const { name, email, planId, billingCycle, paymentStatus } = useOnboarding();

  const [hydrated, setHydrated] = useState(false);
  // The modal auto-opens once; after a manual dismiss we wait for the user to
  // resume via the button instead of re-opening in their face.
  const autoStartedRef = useRef(false);

  const plan = planId ? plans.find((p) => p.id === planId) ?? null : null;

  const checkout = useRazorpayCheckout({
    planId: planId ?? "",
    planName: plan?.name ?? "Membership",
    billingCycle,
    name,
    email,
    // Small delay so the success state is perceivable before redirect.
    onSuccess: () =>
      window.setTimeout(() => router.push("/onboarding/handoff"), 700),
  });

  // The store is persisted to localStorage — on first render it returns the
  // default (empty) state, then rehydrates a tick later. Without this gate the
  // redirect guards below see planId=null and bounce back to /plan.
  useEffect(() => {
    if (useOnboarding.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useOnboarding.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    return unsub;
  }, []);

  // Guard: if user landed here without a plan, bounce back to plan select.
  useEffect(() => {
    if (!hydrated) return;
    if (!planId) {
      router.replace("/onboarding/plan");
      return;
    }
    if (!email || !name) {
      router.replace("/onboarding/welcome");
    }
  }, [hydrated, planId, email, name, router]);

  // If we already paid in a prior session (persisted store), skip ahead.
  useEffect(() => {
    if (!hydrated) return;
    if (paymentStatus === "paid") {
      router.replace("/onboarding/handoff");
    }
  }, [hydrated, paymentStatus, router]);

  // Launch the payment as soon as the store is ready — no confirm step.
  const startCheckout = checkout.start;
  useEffect(() => {
    if (!hydrated) return;
    if (!planId || !email || !name) return;
    if (paymentStatus === "paid") return;
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startCheckout();
  }, [hydrated, planId, email, name, paymentStatus, startCheckout]);

  if (!plan) {
    // Guard effect above will redirect; render nothing in the meantime.
    return null;
  }

  // Until the server confirms, preview the env-driven discounted first charge
  // (same numbers the plan step showed). Once the subscription exists, its
  // amount is authoritative — the server applies the Razorpay offer
  // (lib/razorpay/offers.ts), so the two only differ if the offer env vars
  // drift from NEXT_PUBLIC_FLAT_DISCOUNT_INR.
  const preview = discountedPrice(plan, billingCycle);
  const baseAmountPaise = preview.base * 100;
  const displayAmountPaise = checkout.amountPaise ?? preview.price * 100;
  const discounted = displayAmountPaise < baseAmountPaise;
  const cycleSuffix = billingCycle === "annual" ? " / year" : " / month";

  const { phase, dismissed, error } = checkout;
  const busy =
    phase === "creating" || phase === "opening" || phase === "verifying";

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
      className="flex min-h-full flex-1 flex-col"
    >
      <div>
        <h1 className="font-display text-[40px] leading-tight tracking-[-0.02em] text-white md:text-[56px]">
          {phase === "succeeded" ? "Payment confirmed." : "Almost there."}
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-white/80">
          Secure checkout powered by Razorpay. Cancel anytime from your
          account.
        </p>

        {/* Order summary — the numbers the user is about to pay. Shows the
            env-driven discount preview immediately; once the subscription is
            created the server's (offer-discounted) amount takes over. */}
        <div className="mt-8 max-w-md rounded-[12px] border border-white/15 bg-white/10 p-6">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-white/60">
            Order summary
          </p>
          <p className="mt-2 text-[16px] font-semibold text-white">
            {plan.name}
          </p>
          <p className="text-[13px] text-white/70">
            {billingCycle === "annual" ? "Annual" : "Monthly"} membership ·
            billed {billingCycle === "annual" ? "yearly" : "monthly"}
          </p>

          <div className="mt-4 space-y-2 border-t border-white/15 pt-4 text-[14px]">
            <div className="flex items-baseline justify-between text-white/80">
              <span>
                {billingCycle === "annual" ? "First year" : "First month"}
              </span>
              <span className={discounted ? "text-white/50 line-through" : ""}>
                {formatINR(baseAmountPaise)}
              </span>
            </div>
            {discounted && (
              <div className="flex items-baseline justify-between font-semibold text-green-400">
                <span>Launch offer</span>
                <span>−{formatINR(baseAmountPaise - displayAmountPaise)}</span>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-baseline justify-between border-t border-white/15 pt-3">
            <span className="text-[14px] font-semibold text-white">
              Due today
            </span>
            <span className="font-numeral text-[24px] leading-none text-white">
              {formatINR(displayAmountPaise)}
            </span>
          </div>
          <p className="mt-2 text-[12px] text-white/60">
            {discounted && flatDiscount.firstCycleOnly
              ? `Renews at ${formatINR(baseAmountPaise)}${cycleSuffix} · Incl. GST`
              : "Incl. GST"}
          </p>
        </div>

        <div className="mt-10">
          {busy || (phase === "idle" && !dismissed) ? (
            <div className="flex items-center gap-3 text-[15px] text-white/80">
              <CircleNotch
                size={20}
                className="animate-spin text-green-400"
                aria-hidden
              />
              {phase === "verifying"
                ? "Verifying your payment…"
                : phase === "opening"
                  ? "Complete your payment in the Razorpay window."
                  : "Opening secure checkout…"}
            </div>
          ) : null}

          {phase === "idle" && dismissed ? (
            <p className="text-[15px] text-white/80">
              Checkout closed. Use the button below to resume your payment.
            </p>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-[12px] border border-red-300/40 bg-red-50 p-4 text-[14px] text-red-700"
            >
              <WarningCircle
                size={18}
                weight="fill"
                className="mt-0.5 shrink-0"
                aria-hidden
              />
              <span>{error}</span>
            </div>
          ) : null}

          {phase === "succeeded" ? (
            <div className="flex items-center gap-2 text-[15px] font-semibold text-green-400">
              <CheckCircle size={20} weight="fill" aria-hidden />
              Payment confirmed. Taking you to your courses…
            </div>
          ) : null}
        </div>

        <p className="mt-8 flex items-center gap-2 text-[12px] text-white/60">
          <Lock size={14} aria-hidden />
          PCI-DSS Level 1 checkout. We never see your card details.
        </p>
      </div>

      <BottomNav
        backHref="/onboarding/plan"
        onContinue={() => void checkout.start()}
        continueDisabled={busy || phase === "succeeded"}
        continueLoading={busy}
        continueLabel={
          phase === "failed"
            ? "Retry"
            : phase === "verifying"
              ? "Verifying…"
              : phase === "succeeded"
                ? "Continuing…"
                : `Pay ${formatINR(displayAmountPaise)}`
        }
      />
    </motion.div>
  );
}
