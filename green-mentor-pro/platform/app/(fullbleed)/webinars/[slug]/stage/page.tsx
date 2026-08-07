import { notFound, redirect } from "next/navigation";
import { resolveWebinar } from "@/lib/webinars/repo";
import { createClient } from "@/lib/supabase/server";
import { StageClient } from "./stage-client";

export const dynamic = "force-dynamic";

// Internal embed URL — the live page iframes it; never index it.
export const metadata = { robots: { index: false, follow: false } };

/**
 * Chrome-less host page for the Zoom Client View, designed to be iframed by
 * the live room (components/webinars/zoom-embed.tsx). Client View is Zoom's
 * full web-client UI and assumes it owns the entire viewport, so it gets a
 * document of its own: the iframe's viewport IS the stage. Opening the URL
 * directly in a tab also works (the postMessage bridge just goes quiet).
 *
 * Same guard as ../live/page.tsx: any signed-in user, gated in-page because
 * middleware PROTECTED_PATHS is prefix-based and /webinars is public. On the
 * rare session-expiry race the login redirect renders inside the iframe, so
 * `next` points at the user-facing live room rather than this embed.
 *
 * `slug` is normally the webinar uuid (the parent passes webinar.id — the
 * signature route is keyed by id), but resolveWebinar accepts share slugs
 * too. No canonical-slug redirect: this URL is internal, not shareable.
 * `?left=1` is the Zoom leaveUrl round-trip target (see stage-client.tsx).
 */
export default async function WebinarStagePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ left?: string | string[] }>;
}) {
  const { slug } = await params;
  const { left } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/webinars/${slug}/live`)}`);

  const webinar = await resolveWebinar(slug);
  if (!webinar) notFound();

  return <StageClient webinarId={webinar.id} left={left === "1"} />;
}
