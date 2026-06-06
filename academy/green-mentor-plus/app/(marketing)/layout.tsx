import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { FloatingWhatsApp } from "@/components/marketing/FloatingWhatsApp";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="flex flex-col -mt-21 flex-1">{children}</main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  );
}
