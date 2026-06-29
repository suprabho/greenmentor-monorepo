import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { FloatingWhatsApp } from "@/components/marketing/FloatingWhatsApp";

/**
 * Marketing shell — full-bleed, no app Shell (sidebar/topbar). Scopes the
 * Manrope display font to the landing subtree; app routes keep Inter.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink text-[18px] leading-normal font-[family-name:var(--font-manrope)]">
      <Nav />
      <main className="flex flex-col -mt-21 flex-1">{children}</main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  );
}
