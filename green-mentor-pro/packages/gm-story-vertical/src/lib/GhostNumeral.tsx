'use client'

import type { CSSProperties } from 'react'
import { FONT, ON_DARK, ON_LIGHT } from './tokens'

/**
 * Oversized ghosted display figure — the corpus's signature background
 * element (the 130px issue numeral bleeding off the hero corner, the 160px
 * quote glyph behind the pullquote). Pure presentation: parallax, when wanted,
 * is applied by the parent via transform.
 */
export default function GhostNumeral({
  text,
  onDark,
  size = 'clamp(96px, 18vw, 200px)',
  style,
}: {
  text: string
  onDark: boolean
  size?: string
  style?: CSSProperties
}) {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        fontFamily: FONT.display,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 0.9,
        letterSpacing: '-0.04em',
        color: onDark ? ON_DARK.ghost : ON_LIGHT.ghost,
        userSelect: 'none',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {text}
    </span>
  )
}
