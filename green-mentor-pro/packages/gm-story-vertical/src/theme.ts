import type { Theme } from '@vismay/viz-engine'
import { GREEN, INK, PAPER } from './lib/tokens'

/**
 * The `greenmentor-editorial` theme, mapped onto the engine's Theme slots so
 * `ThemeProvider` exposes it as CSS vars (`--color-accent`, `--font-serif`, …).
 *
 * Band tints (dark/green/pale surfaces) are deliberately NOT theme slots —
 * they live in `lib/tokens.ts` and render through the `gm:surface` module.
 */
export const GREENMENTOR_THEME: Theme = {
  colors: {
    background: PAPER.white,
    text: INK.black,
    accent: GREEN.base,
    accent2: GREEN.mid,
    teal: GREEN.light,
    surface: PAPER.offWhite,
    muted: INK.muted,
    positive: GREEN.mid,
    line: INK.black,
  },
  fonts: {
    serif: "'Instrument Serif', Georgia, serif",
    sans: "'Syne', system-ui, sans-serif",
    mono: "'DM Mono', ui-monospace, monospace",
  },
}

/**
 * Google Fonts import URL for the editorial type trio. Kept here (rather than
 * content-source's `getFontImportUrl`) because Instrument Serif's editorial
 * voice is the *italic* cut and needs the `ital` axis requested explicitly.
 */
export function gmFontImportUrl(): string {
  const families = [
    'family=Syne:wght@400;600;700;800',
    'family=Instrument+Serif:ital,wght@0,400;1,400',
    'family=DM+Mono:wght@400;500',
  ]
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
}
