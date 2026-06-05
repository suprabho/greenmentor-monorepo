/**
 * The 14-day money-back guarantee — the single risk-reversal repeated at every
 * conversion point (hero, both pricing CTAs, the pricing trust strip, final CTA,
 * FAQ, and the footer Refunds page). Centralised here so the exact wording stays
 * identical everywhere it appears (MB-1).
 *
 * NOTE[ops/legal]: this is a no-questions-asked refund commitment, approved for
 * publish (June 2026). Before deploy, make sure the refund flow and the
 * /legal/refunds page actually honour it — the copy below promises a full refund
 * with no form and no reason required.
 */
export const guarantee = {
  /** One-liner placed under CTAs in small muted text. */
  short: "14-day money-back guarantee. No questions asked.",
  /** Bare label for pills / checkmark strips. */
  label: "14-day money-back guarantee",
  /** Where refund requests go. */
  refundEmail: "help@greenmentor.co",
  /** Full plain-language policy for the FAQ and the /legal/refunds page. */
  full:
    "If you subscribe — on any plan — and decide within 14 days that GreenMentor isn't right for you, email help@greenmentor.co and we'll refund your payment in full. No form to fill. No reason required. No back-and-forth. We'd rather you leave happy than stay resentful. After 14 days, the standard cancellation policy applies — you can cancel anytime before your next billing cycle.",
} as const;
