// Live aura backgrounds for the Header Studio picker.
//
// The aura tool (aura.promad.design) keeps its scenes in a separate Supabase
// project. A scene is linked to a "project" via scene_data.selectedProjectIds[]
// (an array of project ids). We read the green-mentor project's scenes and shape
// them as AuraPreset options, so the Studio always offers the current brand
// backgrounds without hardcoding a list here.

import type { AuraPreset } from "./types";

// The aura project's anon key is publishable — it already ships in the aura
// client bundle — so reading the public `scenes` table is safe. Overridable via
// env in case the project ever moves.
const AURA_SUPABASE_URL =
  process.env.AURA_SUPABASE_URL ?? "https://grbrfpaznehikakupavx.supabase.co";
const AURA_SUPABASE_ANON_KEY =
  process.env.AURA_SUPABASE_ANON_KEY ??
  "sb_publishable_nFT6O21VoCZSKs7lQe-UaA_tSkoc4su";

// The aura "green-mentor" project. Its linked scenes are the brand's header
// backgrounds. (Resolve a different project's id from the aura DB if this moves.)
const GREENMENTOR_PROJECT_ID =
  process.env.AURA_GREENMENTOR_PROJECT_ID ??
  "55b2489b-65ec-4e4b-a998-7c102aded5c1";

// scene_data.backgroundType values that map onto AuraPreset["type"].
const KNOWN_TYPES = new Set<AuraPreset["type"]>([
  "aurora",
  "fluid",
  "liquid",
  "ribbon",
  "waves",
  "particleRing",
  "simple",
  "dandelion",
]);

type SceneRow = {
  title: string | null;
  slug: string | null;
  backgroundType: string | null;
};

/**
 * Fetch the green-mentor project's aura scenes and shape them as AuraPreset
 * options for the Studio picker (newest first). Throws on a non-OK response so
 * the caller can fall back to the bundled presets.
 */
export async function fetchGreenMentorAuraScenes(): Promise<AuraPreset[]> {
  // PostgREST: jsonb containment via the `cs` (contains, @>) operator. Matches
  // scenes whose scene_data.selectedProjectIds includes the project id. Only
  // pull the sub-fields we need, not the multi-KB scene_data.
  const params = new URLSearchParams({
    select: "title,slug,backgroundType:scene_data->>backgroundType",
    scene_data: `cs.${JSON.stringify({ selectedProjectIds: [GREENMENTOR_PROJECT_ID] })}`,
    order: "created_at.desc",
  });
  const url = `${AURA_SUPABASE_URL}/rest/v1/scenes?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      apikey: AURA_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${AURA_SUPABASE_ANON_KEY}`,
    },
    // Refresh hourly: a scene newly linked to the project shows up within the
    // hour with no redeploy.
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`aura scenes fetch failed: ${res.status} ${res.statusText}`);
  }

  const rows = (await res.json()) as SceneRow[];
  return rows
    .filter((r): r is SceneRow & { slug: string; title: string } => !!r.slug && !!r.title)
    .map((r) => ({
      id: r.slug,
      label: r.title,
      slug: r.slug,
      // Fall back to "fluid" for an unknown/missing type — it only drives UX
      // hints, not rendering (the embed renders whatever the slug points at).
      type: KNOWN_TYPES.has(r.backgroundType as AuraPreset["type"])
        ? (r.backgroundType as AuraPreset["type"])
        : "fluid",
      verified: true,
    }));
}
