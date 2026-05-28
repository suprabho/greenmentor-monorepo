import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { Accordion } from "@/components/ui/Accordion";
import { faqs } from "@/lib/data/faqs";

interface FaqSectionProps {
  limit?: number;
}

export function FaqSection({ limit }: FaqSectionProps) {
  const items = limit ? faqs.slice(0, limit) : faqs;

  return (
    <section id="faq" className="bg-white py-24 md:py-28">
      <Container width="default">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <SectionHeader
              label="FAQ"
              title={
                <>
                  Questions, <span className="text-green-700">answered</span>.
                </>
              }
              description="Still unsure? Email sachin@greenmentor.co — we usually respond within a working day."
            />
          </div>
          <div className="md:col-span-7">
            <Accordion items={items} />
          </div>
        </div>
      </Container>
    </section>
  );
}
