import type { Metadata } from "next";
import { ProCarousel } from "@/components/marketing/pro-carousel/ProCarousel";
import { createClient } from "@/lib/supabase/server";

/**
 * Single-fold carousel landing for the Pro platform — Feed, Academy, AI Hub,
 * Jobs, one product card each.
 *
 * Lives in (fullbleed) rather than (marketing) on purpose: it carries its own
 * nav pill and control bar and is exactly one viewport tall, so the marketing
 * shell's sticky Nav, Footer and WhatsApp bubble would all fight it.
 *
 * A Server Component only so the session read stays on the server — the CTA
 * points a signed-in visitor at /home instead of bouncing them through /login,
 * with no logged-out → logged-in href flash on hydration.
 */

const DESCRIPTION =
  "ESG news, short courses, an ESG copilot and a curated jobs board — the Green Mentor Pro platform in four screens.";

export const metadata: Metadata = {
  title: "Green Mentor Pro — Platform",
  description: DESCRIPTION,
  openGraph: { title: "Green Mentor Pro — Platform", description: DESCRIPTION },
};

export default async function ProCarouselPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <ProCarousel ctaHref={user ? "/home" : "/login"} />;
}
