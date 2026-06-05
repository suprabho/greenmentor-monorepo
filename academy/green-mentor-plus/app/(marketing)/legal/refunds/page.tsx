import type { Metadata } from "next";
import { Container } from "@/components/marketing/Container";
import { guarantee } from "@/lib/data/guarantee";

export const metadata: Metadata = {
  title: "Refunds & 14-day money-back guarantee · GreenMentor",
  description:
    "Our no-questions-asked 14-day money-back guarantee, in plain language.",
};

/**
 * Refunds policy — the full guarantee the footer "Refunds" link points to
 * (MB-1). Copy is sourced from the shared `guarantee` constant so it stays in
 * lockstep with the one-liner shown at every conversion point.
 */
export default function RefundsPage() {
  return (
    <section className="bg-white py-20 md:py-28">
      <Container width="default">
        <p className="gm-eyebrow text-green-700">Refunds</p>
        <h1 className="font-display mt-4 text-[36px] leading-tight text-ink md:text-[48px]">
          14-day money-back guarantee
        </h1>
        <div aria-hidden className="gm-section-rule mt-5" />

        <div className="mt-8 space-y-5 text-[17px] leading-relaxed text-gray-700">
          <p className="rounded-[16px] bg-green-100 p-5 text-[18px] font-medium text-green-700">
            {guarantee.short}
          </p>
          <p>{guarantee.full}</p>

          <h2 className="gm-section-label pt-4 text-[22px] text-green-700">
            How to request a refund
          </h2>
          <p>
            Email{" "}
            <a
              href={`mailto:${guarantee.refundEmail}`}
              className="font-semibold text-green-700 underline-offset-4 hover:underline"
            >
              {guarantee.refundEmail}
            </a>{" "}
            from the address on your account within 14 days of your payment.
            That&apos;s it — there&apos;s no form and you don&apos;t need to give
            a reason. We&apos;ll process the full refund to your original payment
            method.
          </p>

          <h2 className="gm-section-label pt-4 text-[22px] text-green-700">
            After 14 days
          </h2>
          <p>
            The standard cancellation policy applies: you can cancel anytime
            before your next billing cycle, and you won&apos;t be charged again.
            You keep access until the end of the cycle you&apos;ve already paid
            for.
          </p>
        </div>

        <p className="mt-12 text-[13px] text-gray-500">
          Questions about a payment? Email {guarantee.refundEmail} — we usually
          respond within a working day.
        </p>
      </Container>
    </section>
  );
}
