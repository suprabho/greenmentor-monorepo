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
 * Idempotent: sections that already carry a gm:surface or regions-form
 * foreground pass through untouched, so hand-tuned tones survive
 * regeneration of OTHER sections.
 */

type AnySection = Record<string, unknown>

const FIXED_TONES: Record<string, SurfaceTone> = {
  'gm:hero': 'dark',
  'gm:standfirst': 'off',
  'gm:pullquote': 'green',
  'gm:takeaways': 'dark',
  'gm:audienceStrip': 'pale',
  'gm:footer': 'dark',
}

function leadLayerType(section: AnySection): string | null {
  const fg = section.foreground
  if (Array.isArray(fg)) {
    const first = fg[0] as { type?: unknown } | undefined
    return typeof first?.type === 'string' ? first.type : null
  }
  if (fg && typeof fg === 'object' && 'regions' in (fg as object)) {
    const regions = (fg as { regions: Record<string, unknown> }).regions
    const dflt = regions?.default
    if (Array.isArray(dflt)) {
      const first = dflt[0] as { type?: unknown } | undefined
      return typeof first?.type === 'string' ? first.type : null
    }
  }
  return null
}

function hasGmSurface(section: AnySection): boolean {
  const bg = section.background
  const layers = Array.isArray(bg) ? bg : bg ? [bg] : []
  return layers.some((l) => (l as { type?: unknown })?.type === 'gm:surface')
}

export function applyGmBandRhythm<T extends { sections?: unknown }>(config: T): T {
  const sections = Array.isArray(config.sections) ? (config.sections as AnySection[]) : []
  let prevTone: SurfaceTone = 'dark' // stories open on the dark hero band

  const next = sections.map((section) => {
    const out: AnySection = { ...section }

    // 1. Canonical regions-form foreground.
    if (Array.isArray(out.foreground)) {
      out.foreground = { layout: 'free', regions: { default: out.foreground } }
    }

    // 2. Band tone.
    const lead = leadLayerType(out)
    const fixedTone = lead ? FIXED_TONES[lead] : undefined
    if (hasGmSurface(out)) {
      const bg = (Array.isArray(out.background) ? out.background : [out.background]) as {
        type?: string
        tone?: SurfaceTone
      }[]
      const stampedTone = bg.find((l) => l?.type === 'gm:surface')?.tone ?? 'light'
      // Fixed-tone modules (hero, pullquote, ...) always need their exact
      // tone, even if a gm:surface was already stamped before the module
      // type was known (materialize stamps an empty placeholder; the
      // visual pass fills in the real layer afterwards). Content bands
      // with no fixed tone keep their stamped value so hand-tuned tones
      // survive regeneration of OTHER sections.
      if (fixedTone !== undefined && stampedTone !== fixedTone) {
        out.background = bg.map((l) => (l?.type === 'gm:surface' ? { ...l, tone: fixedTone } : l))
        prevTone = fixedTone
        return out
      }
      prevTone = stampedTone
      return out
    }
    let tone: SurfaceTone | undefined = fixedTone
    if (tone === undefined) {
      // Content band: alternate light/tint against whatever came before.
      tone = prevTone === 'light' ? 'tint' : 'light'
    }
    if (tone === 'dark' && prevTone === 'dark') tone = 'green'
    out.background = [{ type: 'gm:surface', tone }, ...(Array.isArray(out.background) ? (out.background as unknown[]) : [])]
    prevTone = tone
    return out
  })

  return { ...config, sections: next }
}

/** Sanity export so the tone map stays importable for tests/tools. */
export const GM_BAND_TONES = Object.keys(SURFACE_COLOR) as SurfaceTone[]
