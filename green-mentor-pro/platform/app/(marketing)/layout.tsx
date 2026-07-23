import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { FloatingWhatsApp } from "@/components/marketing/FloatingWhatsApp";
import { MarketingAuthProvider } from "@/components/marketing/MarketingAuthProvider";
import { createClient } from "@/lib/supabase/server";

/**
 * Marketing shell — full-bleed, no app Shell (sidebar/topbar). Scopes the
 * Manrope display font to the landing subtree; app routes keep Inter. Reads the
 * session so signed-in visitors get CTAs that lead into the app (`/home`).
 */
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <MarketingAuthProvider isAuthed={!!user}>
      <div className="flex min-h-screen flex-col bg-white text-ink text-[18px] leading-normal font-[family-name:var(--font-manrope)]">
        <Nav />
        <main className="flex flex-col -mt-21 flex-1">{children}</main>
        <Footer />
        <FloatingWhatsApp />
      </div>
    </MarketingAuthProvider>
  );
}
