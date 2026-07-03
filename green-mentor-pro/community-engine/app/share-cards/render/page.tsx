import { createClient } from "@/lib/supabase/server";
import { getHandoff } from "@/lib/share-cards/handoff";
import { CardStage } from "@/lib/share-cards/CardStage";
import { StaticCardLayers } from "@/lib/share-cards/StaticCardLayers";
import { normalizeSnapshot, stageSizeFor, DEFAULT_RATIO } from "@/lib/share-cards/types";

// The chrome-less export surface: the SAME CardStage the studio previews,
// loaded by the export API's headless browser (cookie-less — this path is on
// the middleware's public list) and screenshotted at #card-stage. The config
// arrives via the export handoff row, with picks already resolved server-side,
// so this page performs no client fetches. (Module registration happens at
// client-module scope inside StaticCardLayers.)
export const dynamic = "force-dynamic";

/** Neutral placeholder — a missing/expired id must render SOMETHING stable
 *  (never redirect or 500) so a stray screenshot fails visibly, not weirdly. */
function PlaceholderStage() {
  const size = stageSizeFor(DEFAULT_RATIO);
  return (
    <div
      id="card-stage"
      style={{
        width: size.w,
        height: size.h,
        background: "#014A50",
        display: "grid",
        placeItems: "center",
        color: "rgba(255,255,255,0.6)",
        fontSize: 14,
      }}
    >
      Export expired — try again.
    </div>
  );
}

export default async function ShareCardRenderPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) return <PlaceholderStage />;

  const supabase = await createClient();
  const payload = await getHandoff(supabase, id);
  if (!payload) return <PlaceholderStage />;

  const snapshot = normalizeSnapshot(payload.snapshot);
  const data = payload.data ?? { articles: [] };

  return (
    <CardStage frame={snapshot.frame} ratio={snapshot.ratio} data={data}>
      <StaticCardLayers layers={snapshot.foreground} />
    </CardStage>
  );
}
