/**
 * Ambient typings for Razorpay's browser Checkout SDK, which is loaded as a
 * script from https://checkout.razorpay.com/v1/checkout.js and attaches a
 * `Razorpay` constructor to `window`.
 *
 * Only the surface we actually use is typed — the SDK accepts many more
 * fields. See https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/.
 */

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  subscription_id: string;
  name?: string;
  description?: string;
  image?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    confirm_close?: boolean;
  };
}

interface RazorpayInstance {
  open: () => void;
  on: (
    event: "payment.failed",
    handler: (response: { error: { description?: string } }) => void,
  ) => void;
}

interface RazorpayConstructor {
  new (options: RazorpayCheckoutOptions): RazorpayInstance;
}

interface Window {
  Razorpay?: RazorpayConstructor;
}
