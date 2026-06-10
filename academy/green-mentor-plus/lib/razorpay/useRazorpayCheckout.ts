"use client";

/**
 * Razorpay Checkout as a hook — creates the subscription, loads checkout.js,
 * opens the modal and verifies the payment. Extracted from the checkout step
 * so the modal can launch from any page: the plan step opens it in place, and
 * /onboarding/checkout stays as a thin auto-start shell for deep links and
 * the handoff guard.
 *
 * The caller owns navigation (onSuccess) and all rendering; this hook owns the
 * payment lifecycle, the onboarding-store payment fields, and the checkout
 * analytics events.
 */

import { useCallback, useRef, useState } from "react";
import { useOnboarding, type BillingCycle } from "@/lib/store/onboarding";
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

/**
 * - idle       — nothing in flight (also after a dismissed modal — see
 *                `dismissed` — so the user can resume via start())
 * - creating   — POSTing /api/razorpay/subscription
 * - opening    — modal is up; waiting on the user
 * - verifying  — payment made; POSTing /api/razorpay/verify
 * - succeeded  — verified; onSuccess has fired
 * - failed     — any error; `error` has the message, start() retries
 */
export type CheckoutPhase =
  | "idle"
  | "creating"
  | "opening"
  | "verifying"
  | "succeeded"
  | "failed";

let scriptPromise: Promise<void> | null = null;

/** Inject checkout.js once per session; resolves immediately when present. */
function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = RAZORPAY_CHECKOUT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        // Drop the failed tag so a retry injects a fresh one.
        scriptPromise = null;
        script.remove();
        reject(
          new Error("Razorpay Checkout failed to load. Check your connection."),
        );
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

interface CheckoutInput {
  planId: string;
  planName: string;
  billingCycle: BillingCycle;
  name: string;
  email: string;
  /** Fires once the payment is verified — navigate to the next step here. */
  onSuccess: () => void;
}

export function useRazorpayCheckout(input: CheckoutInput) {
  const { planId, planName, billingCycle, name, email, onSuccess } = input;
  const setRazorpaySubscriptionId = useOnboarding(
    (s) => s.setRazorpaySubscriptionId,
  );
  const setPaymentResult = useOnboarding((s) => s.setPaymentResult);
  const setPaymentStatus = useOnboarding((s) => s.setPaymentStatus);

  const [phase, setPhase] = useState<CheckoutPhase>("idle");
  /** True after the user closed the modal without paying — `idle` + resumable. */
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Server-confirmed first charge in paise (already offer-discounted). */
  const [amountPaise, setAmountPaise] = useState<number | null>(null);
  // One subscription per (plan, cycle): a dismissed modal resumes the same
  // subscription instead of creating a new one on Razorpay's side.
  const subscriptionRef = useRef<
    (CreateSubscriptionResponse & {
      planId: string;
      billingCycle: BillingCycle;
    }) | null
  >(null);
  const busyRef = useRef(false);

  const start = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    try {
      let sub = subscriptionRef.current;
      if (!sub || sub.planId !== planId || sub.billingCycle !== billingCycle) {
        setPhase("creating");
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
        sub = { ...json, planId, billingCycle };
        subscriptionRef.current = sub;
        setAmountPaise(json.amountPaise);
        setRazorpaySubscriptionId(json.subscriptionId);
        // Record that they reached payment — the highest-intent drop-off point.
        syncLead("checkout");
        track("begin_checkout", {
          currency: json.currency,
          value: json.amountPaise / 100,
          items: [
            {
              item_id: planId,
              item_name: planName,
              item_variant: billingCycle,
              price: json.amountPaise / 100,
            },
          ],
        });
      }

      await loadCheckoutScript();
      const RazorpayCtor = window.Razorpay;
      if (!RazorpayCtor) {
        throw new Error("Razorpay Checkout failed to load. Please retry.");
      }

      const confirmed = sub;
      setDismissed(false);
      setPhase("opening");
      track("checkout_opened", { planId, billingCycle });

      const rzp = new RazorpayCtor({
        key: confirmed.keyId,
        subscription_id: confirmed.subscriptionId,
        name: "GM Academy",
        description: `${planName} · ${billingCycle}`,
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
              currency: confirmed.currency,
              value: confirmed.amountPaise / 100,
              items: [
                {
                  item_id: planId,
                  item_name: planName,
                  item_variant: billingCycle,
                  price: confirmed.amountPaise / 100,
                },
              ],
            });
            onSuccess();
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
            // Keep the subscription — resume re-opens it without recreating.
            setDismissed(true);
            setPhase("idle");
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
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not start checkout.",
      );
      setPhase("failed");
    } finally {
      busyRef.current = false;
    }
  }, [
    planId,
    planName,
    billingCycle,
    name,
    email,
    onSuccess,
    setRazorpaySubscriptionId,
    setPaymentResult,
    setPaymentStatus,
  ]);

  return { phase, dismissed, error, amountPaise, start };
}
