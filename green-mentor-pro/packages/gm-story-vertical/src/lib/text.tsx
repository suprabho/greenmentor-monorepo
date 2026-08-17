import type { CSSProperties, ReactNode } from 'react'
import { FONT } from './tokens'

/**
 * Render the corpus's signature emphasis: `*spans*` inside a Syne headline
 * become italic Instrument Serif in the accent color (the `<em>` move every
 * hero title in the newsletter corpus uses).
 */
export function renderEmphasis(text: string, accentColor: string): ReactNode[] {
  const parts = text.split(/(\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em
          key={i}
          style={{
            fontFamily: FONT.serif,
            fontStyle: 'italic',
            fontWeight: 400,
            color: accentColor,
            letterSpacing: '0',
          }}
        >
          {part.slice(1, -1)}
        </em>
      )
    }
    return part
  })
}

/** The eyebrow atom: 24×2px accent rule + tracked mono uppercase kicker. */
export function Eyebrow({
  text,
  accent,
  color,
  style,
}: {
  text: string
  accent: string
  color: string
  style?: CSSProperties
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...style }}>
      <span style={{ width: 24, height: 2, background: accent, flexShrink: 0 }} />
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          color,
        }}
      >
        {text}
      </span>
    </div>
  )
}

/** Pill tag (hero tags, audience chips, badges): mono uppercase in a pill. */
export function Chip({
  text,
  color,
  borderColor,
  background,
}: {
  text: string
  color: string
  borderColor: string
  background?: string
}) {
  return (
    <span
      style={{
        fontFamily: FONT.mono,
        fontSize: 9.5,
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        color,
        border: `1px solid ${borderColor}`,
        background: background ?? 'transparent',
        borderRadius: 40,
        padding: '5px 12px',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  )
}
