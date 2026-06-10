"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { motion } from "framer-motion";
import { CheckCircle, CircleNotch, Lock, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { useOnboarding } from "@/lib/store/onboarding";
import { plans } from "@/lib/data/plans";
import { BottomNav } from "@/components/onboarding/BottomNav";
import { track } from "@/lib/utils/analytics";
import { syncLead } from "@/lib/lead/sync";
import type {
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
  ErrorResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
} from "@/lib/razorpay/types";

const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

interface SubscriptionState {
  subscriptionId: string;
  keyId: string;
  amountPaise: number;
  currency: string;
}

// This step is a pass-through: it creates the subscription and immediately
// opens Razorpay Checkout — there is no confirm screen. The page only renders
// a status (launching / dismissed / verifying / failed) around the modal; the
// plan step already showed the price.
export default function CheckoutStep() {
  const router = useRouter();
  const {
    name,
    email,
    planId,
    billingCycle,
    paymentStatus,
    setRazorpaySubscriptionId,
    setPaymentResult,
    setPaymentStatus,
    resetPayment,
  } = useOnboarding();

  const [subscription, setSubscription] = useState<SubscriptionState | null>(
    null,
  );
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<
    "loading" | "ready" | "opening" | "verifying" | "succeeded" | "failed"
  >("loading");
  const [hydrated, setHydrated] = useState(false);
  const createInFlightRef = useRef(false);
  // The modal auto-opens once; after a manual dismiss we wait for the user to
  // resume via the button instead of re-opening in their face.
  const autoOpenedRef = useRef(false);

  const plan = planId ? plans.find((p) => p.id === planId) ?? null : null;

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

  // Create the Razorpay subscription on mount.
  useEffect(() => {
    if (!hydrated) return;
    if (!planId || !email || !name) return;
    if (createInFlightRef.current) return;
    createInFlightRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const body: CreateSubscriptionRequest = {
          planId,
          billingCycle,
          name,
          email,
        };
        const res = await fetch("/api/razorpay/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as
          | CreateSubscriptionResponse
          | ErrorResponse;
        if (!res.ok || "error" in json) {
          throw new Error(
            "error" in json ? json.error : "Could not start checkout.",
          );
        }
        if (cancelled) return;
        setSubscription(json);
        setRazorpaySubscriptionId(json.subscriptionId);
        setPhase("ready");
        // Record that they reached payment — the highest-intent drop-off point.
        syncLead("checkout");
        track("begin_checkout", {
          currency: json.currency,
          value: json.amountPaise / 100,
          items: [
            {
              item_id: planId,
              item_name: plan?.name,
              item_variant: billingCycle,
              price: json.amountPaise / 100,
            },
          ],
        });
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Could not start checkout.",
        );
        setPhase("failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    hydrated,
    planId,
    billingCycle,
    name,
    email,
    plan?.name,
    setRazorpaySubscriptionId,
  ]);

  const openCheckout = useCallback(() => {
    if (!subscription || !scriptReady) return;
    const { amountPaise, currency } = subscription;
    const RazorpayCtor = window.Razorpay;
    if (!RazorpayCtor) {
      setError("Razorpay Checkout failed to load. Please retry.");
      setPhase("failed");
      return;
    }

    setPhase("opening");
    track("checkout_opened", { planId, billingCycle });

    const rzp = new RazorpayCtor({
      key: subscription.keyId,
      subscription_id: subscription.subscriptionId,
      name: "GM Academy",
      description: plan ? `${plan.name} · ${billingCycle}` : "Membership",
      prefill: { name, email },
      theme: { color: "#009C62" },
      handler: async (response) => {
        setPhase("verifying");
        try {
          const verifyBody: VerifyPaymentRequest = {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_subscription_id: response.razorpay_subscription_id,
            razorpay_signature: response.razorpay_signature,
          };
          const verifyRes = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(verifyBody),
          });
          const verifyJson = (await verifyRes.json()) as
            | VerifyPaymentResponse
            | ErrorResponse;

          if (!verifyRes.ok || "error" in verifyJson) {
            setError(
              "error" in verifyJson
                ? verifyJson.error
                : "Payment could not be verified.",
            );
            setPaymentStatus("failed");
            setPhase("failed");
            track("checkout_failed", { reason: "verification" });
            return;
          }

          setPaymentResult({
            paymentId: response.razorpay_payment_id,
            subscriptionId: response.razorpay_subscription_id,
          });
          setPhase("succeeded");
          track("checkout_succeeded", { planId, billingCycle });
          track("purchase", {
            transaction_id: response.razorpay_payment_id,
            currency,
            value: amountPaise / 100,
            items: [
              {
                item_id: planId,
                item_name: plan?.name,
                item_variant: billingCycle,
                price: amountPaise / 100,
              },
            ],
          });
          // Small delay so the success state is perceivable before redirect.
          window.setTimeout(() => router.push("/onboarding/handoff"), 700);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not verify the payment.",
          );
          setPaymentStatus("failed");
          setPhase("failed");
          track("checkout_failed", { reason: "network" });
        }
      },
      modal: {
        ondismiss: () => {
          // Don't blow away the subscription id — they can retry without
          // creating a new one on Razorpay's side.
          setPhase("ready");
          track("checkout_dismissed", { planId, billingCycle });
        },
      },
    });

    rzp.on("payment.failed", (response) => {
      setError(
        response.error?.description ??
          "Payment failed. Please try a different method.",
      );
      setPaymentStatus("failed");
      setPhase("failed");
      track("checkout_failed", { reason: "payment.failed" });
    });

    rzp.open();
  }, [
    subscription,
    scriptReady,
    name,
    email,
    plan,
    planId,
    billingCycle,
    router,
    setPaymentResult,
    setPaymentStatus,
  ]);

  // Launch the modal as soon as both the subscription and the script are
  // ready — this page has no confirm step.
  useEffect(() => {
    if (phase !== "ready" || !scriptReady || !subscription) return;
    if (autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    openCheckout();
  }, [phase, scriptReady, subscription, openCheckout]);

  function handleRetry() {
    setError(null);
    if (subscription) {
      // Subscription still valid — just reopen the modal.
      openCheckout();
      return;
    }
    // Otherwise force a re-create.
    resetPayment();
    createInFlightRef.current = false;
    autoOpenedRef.current = false;
    setPhase("loading");
  }

  if (!plan) {
    // Guard effect above will redirect; render nothing in the meantime.
    return null;
  }

  const baseAmountPaise =
    (billingCycle === "annual" ? plan.priceAnnualTotal : plan.priceMonthly) *
    100;
  const displayAmountPaise = subscription?.amountPaise ?? baseAmountPaise;
  // The server applies the env-configured launch offer (lib/razorpay/offers.ts)
  // to the returned amount — when it's below the list price, label it as the
  // first charge so the recurring price stays clear.
  const discounted = displayAmountPaise < baseAmountPaise;

  const launching =
    phase === "loading" || (phase === "ready" && !autoOpenedRef.current);

  return (
    <>
      <Script
        src={RAZORPAY_CHECKOUT_SRC}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => {
          setError("Razorpay Checkout failed to load. Check your connection.");
          setPhase("failed");
        }}
      />

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
            {plan.name} · {billingCycle === "annual" ? "Annual" : "Monthly"} ·{" "}
            {formatINR(displayAmountPaise)}
            {discounted
              ? `${billingCycle === "annual" ? " first year, then " : " first month, then "}${formatINR(baseAmountPaise)}${billingCycle === "annual" ? " / year" : " / month"}`
              : billingCycle === "annual"
                ? " / year"
                : " / month"}{" "}
            — secure checkout powered by Razorpay. Cancel anytime from your
            account.
          </p>

          <div className="mt-10">
            {launching || phase === "opening" || phase === "verifying" ? (
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

            {phase === "ready" && autoOpenedRef.current ? (
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
          onContinue={phase === "failed" ? handleRetry : openCheckout}
          continueDisabled={
            phase === "loading" ||
            phase === "opening" ||
            phase === "verifying" ||
            phase === "succeeded"
          }
          continueLoading={
            phase === "loading" || phase === "opening" || phase === "verifying"
          }
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
    </>
  );
}
