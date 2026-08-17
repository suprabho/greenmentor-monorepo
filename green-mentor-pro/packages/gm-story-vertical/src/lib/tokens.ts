/**
 * GreenMentor editorial design tokens.
 *
 * Single source of truth, extracted from the newsletter corpus
 * (~34 issues; the `:root` block is byte-identical across all of them).
 * Components use these constants directly via inline styles so rendering is
 * deterministic in every mode (scroll / capture / print) and independent of
 * any consumer's Tailwind content graph.
 */

export const INK = {
  black: '#0e0e0c',
  black2: '#1c1c19',
  black3: '#2a2a26',
  prose: '#444440',
  dense: '#3a3a36',
  muted: '#888882',
} as const

export const GREEN = {
  base: '#2c6e3f',
  mid: '#3a8a52',
  light: '#5cb870',
  pale: '#d4edda',
  ultra: '#eaf5ec',
} as const

export const PAPER = {
  white: '#f7f6f2',
  offWhite: '#eeede8',
  page: '#d8d6cf',
} as const

/** 1px hairline on light surfaces. */
export const RULE = 'rgba(14,14,12,0.1)'

/** White-alpha ladder for dark/green surfaces. */
export const ON_DARK = {
  ghost: 'rgba(255,255,255,0.08)',
  hairline: 'rgba(255,255,255,0.15)',
  secondary: 'rgba(255,255,255,0.5)',
  body: 'rgba(255,255,255,0.7)',
  full: '#ffffff',
} as const

/** Ink ladder for light surfaces (mirror of ON_DARK so components can swap). */
export const ON_LIGHT = {
  ghost: 'rgba(14,14,12,0.07)',
  hairline: RULE,
  secondary: INK.muted,
  body: INK.prose,
  full: INK.black,
} as const

/**
 * Surface bands. The corpus's core compositional device is a fixed rhythm of
 * full-bleed color bands: green topbar → black hero → off-white intro →
 * white/green-ultra sections → green pullquote → black takeaways → pale
 * audience → dark footer. `gm:surface` renders these; `surfaceInk` tells
 * foreground modules which ink ladder to use on each.
 */
export type SurfaceTone = 'light' | 'tint' | 'pale' | 'off' | 'dark' | 'green' | 'page'

export const SURFACE_COLOR: Record<SurfaceTone, string> = {
  light: PAPER.white,
  tint: GREEN.ultra,
  pale: GREEN.pale,
  off: PAPER.offWhite,
  dark: INK.black,
  green: GREEN.base,
  page: PAPER.page,
}

export function surfaceInk(tone: SurfaceTone): 'dark' | 'light' {
  return tone === 'dark' || tone === 'green' ? 'light' : 'dark'
}

/** Ink ladder for a given band tone. */
export function inkFor(onDark: boolean) {
  return onDark ? ON_DARK : ON_LIGHT
}

/** Accent color that stays legible on the given surface. */
export function accentFor(onDark: boolean): string {
  return onDark ? GREEN.light : GREEN.base
}

/** Spacing & shape conventions (px). */
export const SPACE = {
  gutter: 36,
  band: 44,
  bandLoose: 48,
} as const

export const RADIUS = {
  card: 6,
  pill: 40,
  badge: 3,
} as const

/** The deliberately heavy editorial card border. */
export const CARD_BORDER = (onDark: boolean): string =>
  `1.5px solid ${onDark ? ON_DARK.hairline : INK.black}`

/** Content column: the newsletter's 680px measure, centered over the band. */
export const COLUMN_WIDTH = 'min(680px, 90vw)'
/** Wider column for grids/tables/hero compositions. */
export const COLUMN_WIDE = 'min(880px, 92vw)'

/** Font stacks — matched to GREENMENTOR_THEME's Google Fonts loads. */
export const FONT = {
  display: "'Syne', var(--font-sans, sans-serif)",
  serif: "'Instrument Serif', var(--font-serif, serif)",
  mono: "'DM Mono', var(--font-mono, monospace)",
} as const

/** Meta text (eyebrows, badges, citations): DM Mono, uppercase, tracked. */
export const META_TEXT = {
  fontFamily: FONT.mono,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.16em',
}
