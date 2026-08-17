import type { StoryConfig, StorySectionConfig } from '@vismay/viz-engine'
import type { SurfaceTone } from './tokens'

/**
 * GreenMentor house-style lint, derived from invariants that hold across the
 * entire newsletter corpus. Editors see these as warnings; the compose
 * pipeline runs them after outline/materialize.
 */
export interface GmLintIssue {
  level: 'error' | 'warning'
  rule: string
  message: string
  sectionIndex?: number
}

type Layerish = { type?: unknown; tone?: unknown; [key: string]: unknown }

/** Flatten a section's foreground input (layer | layers | regions map). */
function foregroundLayers(section: StorySectionConfig): Layerish[] {
  const fg = (section as { foreground?: unknown }).foreground
  if (!fg) return []
  if (Array.isArray(fg)) return fg as Layerish[]
  if (typeof fg === 'object' && fg !== null && 'regions' in (fg as object)) {
    const regions = (fg as { regions: Record<string, unknown> }).regions
    return Object.values(regions).flatMap((r) => {
      if (Array.isArray(r)) return r as Layerish[]
      if (r && typeof r === 'object' && 'layers' in (r as object)) {
        const layers = (r as { layers: unknown }).layers
        return Array.isArray(layers) ? (layers as Layerish[]) : []
      }
      return [r as Layerish]
    })
  }
  return [fg as Layerish]
}

function backgroundLayers(section: StorySectionConfig): Layerish[] {
  const bg = (section as { background?: unknown }).background
  if (!bg) return []
  return Array.isArray(bg) ? (bg as Layerish[]) : [bg as Layerish]
}

function surfaceTone(section: StorySectionConfig): SurfaceTone | null {
  const surface = backgroundLayers(section).find((l) => l.type === 'gm:surface')
  if (!surface) return null
  return (surface.tone as SurfaceTone | undefined) ?? 'light'
}

export function lintGmStory(config: StoryConfig): GmLintIssue[] {
  const issues: GmLintIssue[] = []
  const sections = config.sections ?? []

  const countByType = new Map<string, number>()
  sections.forEach((section) => {
    for (const layer of foregroundLayers(section)) {
      if (typeof layer.type === 'string') {
        countByType.set(layer.type, (countByType.get(layer.type) ?? 0) + 1)
      }
    }
  })

  const pullquotes = countByType.get('gm:pullquote') ?? 0
  if (pullquotes === 0) {
    issues.push({
      level: 'warning',
      rule: 'one-pullquote',
      message: 'No gm:pullquote — every corpus issue carries exactly one.',
    })
  } else if (pullquotes > 1) {
    issues.push({
      level: 'error',
      rule: 'one-pullquote',
      message: `${pullquotes} gm:pullquote sections — the house style allows exactly one.`,
    })
  }

  if ((countByType.get('gm:takeaways') ?? 0) === 0) {
    issues.push({
      level: 'warning',
      rule: 'takeaways-present',
      message: 'No gm:takeaways band — the numbered practitioner summary closes every issue.',
    })
  }

  if ((countByType.get('gm:footer') ?? 0) === 0) {
    issues.push({
      level: 'warning',
      rule: 'closing-present',
      message: 'No gm:footer — every corpus issue ends on a closing section.',
    })
  }

  let prevTone: SurfaceTone | null = null
  sections.forEach((section, i) => {
    const tone = surfaceTone(section)
    if (tone === null) {
      issues.push({
        level: 'warning',
        rule: 'surface-band',
        message: 'Section has no gm:surface background — the band rhythm breaks here.',
        sectionIndex: i,
      })
    } else {
      if (tone === 'dark' && prevTone === 'dark') {
        issues.push({
          level: 'warning',
          rule: 'no-adjacent-dark',
          message: 'Two adjacent dark bands — alternate with light/tint/green surfaces.',
          sectionIndex: i,
        })
      }
      prevTone = tone
    }
  })

  return issues
}
