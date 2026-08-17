import { SURFACE_COLOR, type SurfaceTone } from './tokens'

/**
 * GM-specific post-processing over a parsed story config: the vismay
 * pipeline serializes sections with bare foreground layers and no
 * backgrounds, so this pass
 *
 *   1. wraps flat foreground arrays into the canonical regions form
 *      ({layout:'free', regions:{default:[...]}}) — flat arrays would let
 *      the engine's built-in text card render over the slide, and
 *   2. stamps a gm:surface background per section following the corpus band
 *      rhythm (hero dark, standfirst off, pullquote green, takeaways dark,
 *      audience pale, footer dark; content bands alternate light/tint,
 *      never two darks adjacent).
 *
 * Tone provenance: surfaces this pass stamps carry `auto: true`, which marks
 * the tone as band-system-owned — later passes recompute it freely (the
 * compose flow stamps sections BEFORE their visual layers exist, so fixed
 * tones can only land once the lead layer is known). A surface WITHOUT the
 * flag is treated as hand-tuned and passes through untouched, so editor
 * tone choices survive regeneration of any section. (`auto` is not part of
 * surfaceSchema; zod strips it at render parse, and it round-trips harmlessly
 * in the config JSON.)
 *
 * Idempotent: re-running over its own output changes nothing.
 */

type AnySection = Record<string, unknown>

interface SurfaceLayer {
  type?: string
  tone?: SurfaceTone
  auto?: boolean
  [key: string]: unknown
}

const FIXED_TONES: Record<string, SurfaceTone> = {
  'gm:hero': 'dark',
  'gm:standfirst': 'off',
  'gm:pullquote': 'green',
  'gm:takeaways': 'dark',
  'gm:audienceStrip': 'pale',
  'gm:footer': 'dark',
}

/**
 * The pipeline's normalizeSectionBody emits foreground in THREE shapes: a
 * bare single layer object, a flat layer array, or `{layout?, regions:
 * {<name>: Layer[] | {layers: Layer[]}}}` with the layout's own region names.
 * Everything here must read all of them.
 */
function foregroundLayerList(fg: unknown): Array<{ type?: unknown }> {
  if (!fg || typeof fg !== 'object') return []
  if (Array.isArray(fg)) return fg as Array<{ type?: unknown }>
  if ('regions' in (fg as object)) {
    const regions = (fg as { regions: Record<string, unknown> }).regions ?? {}
    return Object.values(regions).flatMap((r) => {
      if (Array.isArray(r)) return r as Array<{ type?: unknown }>
      if (r && typeof r === 'object' && 'layers' in (r as object)) {
        const layers = (r as { layers: unknown }).layers
        return Array.isArray(layers) ? (layers as Array<{ type?: unknown }>) : []
      }
      return [r as { type?: unknown }]
    })
  }
  return [fg as { type?: unknown }]
}

function leadLayerType(section: AnySection): string | null {
  const first = foregroundLayerList(section.foreground)[0]
  return typeof first?.type === 'string' ? first.type : null
}

function backgroundLayers(section: AnySection): SurfaceLayer[] {
  const bg = section.background
  return (Array.isArray(bg) ? bg : bg ? [bg] : []) as SurfaceLayer[]
}

export function applyGmBandRhythm<T extends { sections?: unknown }>(config: T): T {
  const sections = Array.isArray(config.sections) ? (config.sections as AnySection[]) : []
  let prevTone: SurfaceTone | null = null

  const next = sections.map((section) => {
    const out: AnySection = { ...section }

    // 1. Canonical regions-form foreground. Flat arrays AND bare single-layer
    // objects (normalizeForeground's single-layer shortcut) both wrap —
    // outside regions form the engine's built-in text card renders over the
    // slide. Layout-with-named-regions forms are legal and pass through.
    if (Array.isArray(out.foreground)) {
      out.foreground = { layout: 'free', regions: { default: out.foreground } }
    } else if (
      out.foreground &&
      typeof out.foreground === 'object' &&
      !('regions' in (out.foreground as object)) &&
      typeof (out.foreground as { type?: unknown }).type === 'string'
    ) {
      out.foreground = { layout: 'free', regions: { default: [out.foreground] } }
    }

    // 2. Band tone.
    const surface = backgroundLayers(out).find((l) => l.type === 'gm:surface')
    if (surface && surface.auto !== true) {
      // Hand-tuned tone — pass through untouched.
      prevTone = surface.tone ?? 'light'
      return out
    }

    const lead = leadLayerType(out)
    let tone: SurfaceTone | undefined = lead ? FIXED_TONES[lead] : undefined
    if (tone === undefined) {
      // Content band: alternate light/tint against whatever came before.
      tone = prevTone === 'light' ? 'tint' : 'light'
    }
    if (tone === 'dark' && prevTone === 'dark') tone = 'green'

    if (surface) {
      // Auto-stamped earlier (e.g. at materialize, before the visual pass
      // landed) — recompute in place, keeping the provenance flag.
      out.background = backgroundLayers(out).map((l) =>
        l === surface ? { ...l, tone } : l
      )
    } else {
      out.background = [
        { type: 'gm:surface', tone, auto: true },
        ...(Array.isArray(out.background) ? (out.background as unknown[]) : []),
      ]
    }
    prevTone = tone
    return out
  })

  return { ...config, sections: next }
}

/** Sanity export so the tone map stays importable for tests/tools. */
export const GM_BAND_TONES = Object.keys(SURFACE_COLOR) as SurfaceTone[]
