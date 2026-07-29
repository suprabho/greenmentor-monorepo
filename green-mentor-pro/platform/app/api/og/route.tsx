import { ImageResponse } from "next/og";
import { OG_HEIGHT, OG_WIDTH, readOgParams } from "@/lib/share/og";

// Social preview card for the shareable /webinars, /jobs and /feed detail pages.
//
// One shared route rather than three colocated opengraph-image.tsx files: the
// pages already know their own copy, so they just point openGraph.images at a
// URL built by ogImageUrl(). Nothing here reads the database.
//
// Public by design — /api/og isn't in middleware's PROTECTED_PATHS, so crawlers
// (which never carry a session) can fetch it. Everything it renders arrives in
// the query string and is already public data.
//
// No `fonts` option: next/og falls back to the Geist Regular it bundles, so
// there's no .ttf to ship or trace into the serverless bundle. That means one
// weight only — the hierarchy below leans on size and colour instead of bold.

export const runtime = "nodejs";

const TEAL_900 = "#014A50";
const GREEN_500 = "#07D862";
const GREEN_100 = "#DAF4D7";

export function GET(request: Request) {
  const { title, subtitle, badge } = readOgParams(new URL(request.url).searchParams);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: TEAL_900,
          padding: 72,
          // A soft radial bloom keeps the card from reading as a flat block.
          backgroundImage: `radial-gradient(1000px 500px at 85% -10%, rgba(7,216,98,0.28), transparent 70%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 14, height: 14, borderRadius: 999, background: GREEN_500 }} />
          <div style={{ fontSize: 26, color: GREEN_100, letterSpacing: 6, textTransform: "uppercase" }}>
            {badge}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: title.length > 70 ? 62 : 78,
              lineHeight: 1.12,
              color: "#FFFFFF",
              letterSpacing: -1.5,
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div style={{ display: "flex", fontSize: 34, lineHeight: 1.3, color: GREEN_100, opacity: 0.85 }}>
              {subtitle}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 30, color: "#FFFFFF" }}>Green Mentor</div>
          <div style={{ height: 5, width: 150, borderRadius: 999, background: GREEN_500 }} />
        </div>
      </div>
    ),
    { width: OG_WIDTH, height: OG_HEIGHT }
  );
}
