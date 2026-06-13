import { NextResponse } from "next/server";
import { fetchGreenMentorAuraScenes } from "@/lib/header/auraScenes";
import { AURA_PRESETS } from "@/lib/header/types";

// The Header Studio aura picker reads this. Returns the live green-mentor scenes
// as AuraPreset[], falling back to the bundled presets if the aura DB is
// unreachable or has nothing linked — the picker is never empty.
export async function GET() {
  try {
    const scenes = await fetchGreenMentorAuraScenes();
    const presets = scenes.length ? scenes : AURA_PRESETS;
    return NextResponse.json(
      { presets },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
    );
  } catch (err) {
    console.error("[api/aura-scenes]", err);
    return NextResponse.json({ presets: AURA_PRESETS });
  }
}
