import type { Metadata } from "next";
import { Container } from "@/components/marketing/Container";
import { Accordion } from "@/components/ui/Accordion";
import { Eyebrow } from "@/components/ui/Badge";
import { FinalCta } from "@/components/marketing/FinalCta";
import { faqs } from "@/lib/data/faqs";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to the most common questions about Greenmentor.",
};

export default function FaqPage() {
  return (
    <>
      <Container width="default" className="pt-16 pb-16 md:pt-24">
        <header className="mx-auto max-w-3xl text-center">
          <Eyebrow tone="white">FAQ</Eyebrow>
          <h1 className="font-display mt-8 text-[clamp(40px,6vw,72px)] leading-tight tracking-[-0.02em] text-ink">
            Questions, <span className="text-green-700">answered</span>.
          </h1>
          <p className="mt-6 text-[18px] leading-relaxed text-gray-700 md:text-[20px]">
            Still unsure? Email{" "}
            <a
              href="mailto:sachin@greenmentor.co"
              className="font-semibold text-green-700 underline-offset-4 hover:underline"
            >
              sachin@greenmentor.co
            </a>{" "}
            — we usually respond within a working day.
          </p>
        </header>

        <div className="mt-16">
          <Accordion items={faqs} />
        </div>
      </Container>

      <FinalCta />
    </>
  );
}
