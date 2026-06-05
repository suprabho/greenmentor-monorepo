"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { motion } from "framer-motion";
import { CheckCircle, Lock, Tag, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { useOnboarding } from "@/lib/store/onboarding";
import { plans, annualSavingsPercent } from "@/lib/data/plans";
import { Button } from "@/components/ui/Button";
import { BottomNav } from "@/components/onboarding/BottomNav";
import { track } from "@/lib/utils/analytics";
import { syncLead } from "@/lib/lead/sync";
import type {
  AppliedPromo,
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

export default function CheckoutStep() {
  const router = useRouter();
  const {
    name,
    email,
    planId,
    billingCycle,
    razorpaySubscriptionId,
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

  // Promo code state. `appliedPromo` mirrors the server-confirmed discount;
  // `promoBusy` covers the re-create round-trip when applying/removing a code.
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);

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

  // POST to the subscription endpoint. Shared by the on-mount create and the
  // promo apply/remove handlers — applying a code re-creates the subscription
  // because Razorpay can only attach an offer at creation time. Throws on
  // error (incl. an invalid promo code) so callers can surface the message.
  const postSubscription = useCallback(
    async (promoCode?: string): Promise<CreateSubscriptionResponse> => {
      if (!planId) throw new Error("No plan selected.");
      const body: CreateSubscriptionRequest = {
        planId,
        billingCycle,
        name,
        email,
        ...(promoCode ? { promoCode } : {}),
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
      return json;
    },
    [planId, billingCycle, name, email],
  );

  // Create the Razorpay subscription on mount (full price; a promo is applied
  // later by re-creating with the offer attached).
  useEffect(() => {
    if (!hydrated) return;
    if (!planId || !email || !name) return;
    if (createInFlightRef.current) return;
    createInFlightRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const json = await postSubscription();
        if (cancelled) return;
        setSubscription(json);
        setRazorpaySubscriptionId(json.subscriptionId);
        setAppliedPromo(json.appliedPromo ?? null);
        setPhase("ready");
        // Record that they reached payment — the highest-intent drop-off point.
        syncLead("checkout");
        track("begin_checkout", {
          currency: json.currency,
          value: json.amountPaise / 100,
          coupon: json.appliedPromo?.code,
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
    setRazorpaySubscriptionId,
    postSubscription,
  ]);

  // Apply a promo code: re-create the subscription with the offer attached and
  // swap in the discounted amount. On failure the current subscription stays
  // intact and the reason is shown inline next to the input.
  const applyPromo = useCallback(async () => {
    const code = promoInput.trim();
    if (!code || promoBusy) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const json = await postSubscription(code);
      setSubscription(json);
      setRazorpaySubscriptionId(json.subscriptionId);
      setAppliedPromo(json.appliedPromo ?? null);
      track("promo_applied", { code, planId, billingCycle });
    } catch (err) {
      setPromoError(
        err instanceof Error ? err.message : "Couldn't apply that code.",
      );
      track("promo_rejected", { code });
    } finally {
      setPromoBusy(false);
    }
  }, [
    promoInput,
    promoBusy,
    postSubscription,
    setRazorpaySubscriptionId,
    planId,
    billingCycle,
  ]);

  // Remove a typed code: re-create without one. The server re-applies any
  // auto offer for this cycle, so the launch discount falls back into place
  // rather than dropping to full price.
  const removePromo = useCallback(async () => {
    if (promoBusy) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const json = await postSubscription();
      setSubscription(json);
      setRazorpaySubscriptionId(json.subscriptionId);
      setAppliedPromo(json.appliedPromo ?? null);
      setPromoInput("");
    } catch (err) {
      setPromoError(
        err instanceof Error ? err.message : "Couldn't remove the code.",
      );
    } finally {
      setPromoBusy(false);
    }
  }, [promoBusy, postSubscription, setRazorpaySubscriptionId]);

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
            coupon: appliedPromo?.code,
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
    appliedPromo,
    router,
    setPaymentResult,
    setPaymentStatus,
  ]);

  function handleRetry() {
    setError(null);
    if (subscription) {
      // Subscription still valid — just reopen the modal.
      setPhase("ready");
      return;
    }
    // Otherwise force a re-create.
    resetPayment();
    createInFlightRef.current = false;
    setPhase("loading");
  }

  if (!plan) {
    // Guard effect above will redirect; render nothing in the meantime.
    return null;
  }

  const displayAmountPaise =
    subscription?.amountPaise ??
    (billingCycle === "annual"
      ? plan.priceAnnualTotal * 100
      : plan.priceMonthly * 100);

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
          Confirm and pay.
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-white/80">
          Secure checkout powered by Razorpay. Cancel anytime from your
          account.
        </p>

        <div className="mt-10 rounded-[20px] border border-gray-200 bg-white p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[13px] font-semibold tracking-wide text-green-700 uppercase">
                {plan.name} · {billingCycle === "annual" ? "Annual" : "Monthly"}
              </p>
              <h2 className="mt-2 text-[22px] font-bold text-ink">
                {plan.tagline}
              </h2>
            </div>
            {billingCycle === "annual" ? (
              <span className="rounded-full bg-green-500 px-3 py-1 text-[11px] font-bold tracking-wide text-teal-900 uppercase">
                Save {annualSavingsPercent}%
              </span>
            ) : null}
          </div>

          <div className="mt-6 border-t border-gray-200 pt-6">
            <div className="flex items-baseline gap-2">
              <span className="font-numeral text-[48px] leading-none text-green-700">
                {formatINR(displayAmountPaise)}
              </span>
              {appliedPromo ? (
                <span className="font-numeral text-[20px] leading-none text-gray-400 line-through">
                  {formatINR(appliedPromo.originalAmountPaise)}
                </span>
              ) : null}
              <span className="text-[14px] text-gray-500">
                {billingCycle === "annual" ? "/ year" : "/ month"}
              </span>
            </div>
            {billingCycle === "annual" ? (
              appliedPromo?.firstCycleOnly ? (
                <p className="mt-2 text-[13px] text-gray-500">
                  First year · renews at{" "}
                  {formatINR(plan.priceAnnualTotal * 100)} / year
                </p>
              ) : (
                <p className="mt-2 text-[13px] text-gray-500">
                  Billed once a year · works out to{" "}
                  {formatINR(plan.priceAnnual * 100)} / month
                </p>
              )
            ) : appliedPromo?.firstCycleOnly ? (
              <p className="mt-2 text-[13px] text-gray-500">
                First month only · renews at{" "}
                {formatINR(plan.priceMonthly * 100)} / month
              </p>
            ) : null}
          </div>

          <div className="mt-6 border-t border-gray-200 pt-6">
            {appliedPromo ? (
              <div className="flex items-center justify-between gap-3 rounded-[12px] bg-green-50 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2 text-[14px] text-green-700">
                  <Tag size={16} weight="fill" className="shrink-0" aria-hidden />
                  {appliedPromo.auto ? (
                    <span className="truncate font-semibold">
                      {appliedPromo.label}
                    </span>
                  ) : (
                    <>
                      <span className="font-semibold">{appliedPromo.code}</span>
                      <span className="truncate text-green-700/80">
                        · {appliedPromo.label}
                      </span>
                    </>
                  )}
                </div>
                {appliedPromo.auto ? null : (
                  <button
                    type="button"
                    onClick={removePromo}
                    disabled={promoBusy}
                    className="shrink-0 text-[13px] font-medium text-gray-500 underline underline-offset-2 hover:text-gray-700 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            ) : null}

            {/* Input stays available when nothing's applied or only the auto
                launch offer is — so a targeted code can still be entered (it
                overrides the auto offer). Hidden once a typed code wins. */}
            {!appliedPromo || appliedPromo.auto ? (
              <div className={appliedPromo?.auto ? "mt-3" : undefined}>
                <label
                  htmlFor="promo"
                  className="text-[13px] font-medium text-gray-600"
                >
                  {appliedPromo?.auto
                    ? "Have a different code?"
                    : "Have a promo code?"}
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="promo"
                    value={promoInput}
                    onChange={(e) => {
                      setPromoInput(e.target.value);
                      if (promoError) setPromoError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyPromo();
                      }
                    }}
                    placeholder="Enter code"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={promoBusy}
                    className="h-11 flex-1 rounded-[10px] border border-gray-200 bg-white px-3 text-[14px] uppercase tracking-wide text-ink placeholder:normal-case placeholder:tracking-normal placeholder:text-gray-400 focus:border-green-700 focus:ring-1 focus:ring-green-700 focus:outline-none disabled:opacity-50"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-11"
                    onClick={applyPromo}
                    loading={promoBusy}
                    disabled={!promoInput.trim() || promoBusy}
                  >
                    Apply
                  </Button>
                </div>
                {promoError ? (
                  <p className="mt-2 text-[13px] text-red-600">{promoError}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <dl className="mt-6 grid gap-3 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-gray-500">Account</dt>
              <dd className="text-ink">{email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd className="text-ink">{name}</dd>
            </div>
          </dl>

          {error ? (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2 rounded-[12px] border border-red-200 bg-red-50 p-4 text-[14px] text-red-700"
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
            <div className="mt-6 flex items-center gap-2 text-[14px] font-semibold text-green-700">
              <CheckCircle size={18} weight="fill" aria-hidden />
              Payment confirmed. Taking you to your courses…
            </div>
          ) : null}
        </div>

        <p className="mt-4 flex items-center gap-2 text-[12px] text-white/60">
          <Lock size={14} aria-hidden />
          PCI-DSS Level 1 checkout. We never see your card details.
        </p>

        {razorpaySubscriptionId ? (
          <p className="mt-6 text-[11px] text-white/50">
            Subscription ref: {razorpaySubscriptionId}
          </p>
        ) : null}
        </div>

        <BottomNav
          backHref="/onboarding/plan"
          onContinue={phase === "failed" ? handleRetry : openCheckout}
          continueDisabled={
            (phase !== "ready" && phase !== "failed") || promoBusy
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
