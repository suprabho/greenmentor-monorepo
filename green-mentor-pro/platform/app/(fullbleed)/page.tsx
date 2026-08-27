import type { Metadata } from "next";
import { ProCarousel } from "@/components/marketing/pro-carousel/ProCarousel";
import { createClient } from "@/lib/supabase/server";
import { fetchLandingSamples } from "@/lib/marketing/landing-samples";

/**
 * The Green Mentor Pro landing page (`/`) — a single-fold carousel over the
 * four surfaces: Feed, Academy, AI Hub, Jobs, one product card each. Replaced
 * the long-form marketing page ported from green-mentor-plus; the Aura
 * "green background" embed that page ran behind its hero now runs behind the
 * whole fold here.
 *
 * Lives in (fullbleed) rather than (marketing) on purpose: it carries its own
 * nav pill and control bar and is exactly one viewport tall, so the marketing
 * shell's sticky Nav, Footer and WhatsApp bubble would all fight it. The
 * (marketing) group still serves /esg-readiness.
 *
 * A Server Component so the session read and the sample content stay on the
 * server: the CTA points a signed-in visitor at /home instead of bouncing them
 * through /login (no logged-out → logged-in href flash on hydration), and the
 * slides render real product cards — the top feed article, the first in-app
 * course, the newest job — instead of hand-drawn replicas.
 */

const DESCRIPTION =
  "ESG news, short courses, an ESG copilot and a curated jobs board — the Green Mentor Pro platform in four screens.";

export const metadata: Metadata = {
  title: "Green Mentor Pro",
  description: DESCRIPTION,
  openGraph: { title: "Green Mentor Pro", description: DESCRIPTION },
};

export default async function LandingPage() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    samples,
  ] = await Promise.all([supabase.auth.getUser(), fetchLandingSamples()]);

  return <ProCarousel ctaHref={user ? "/home" : "/login"} samples={samples} />;
}
