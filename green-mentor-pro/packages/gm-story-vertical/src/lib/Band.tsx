'use client'

import type { CSSProperties, ReactNode } from 'react'
import { COLUMN_WIDTH } from './tokens'

/**
 * Shared slide frame: fills the unit's foreground box and centers a
 * newsletter-measure column over the full-bleed `gm:surface` band. Every
 * spine module renders inside one of these so the corpus's 680px editorial
 * column survives the move to full-viewport slides.
 */
export default function Band({
  children,
  width = COLUMN_WIDTH,
  align = 'center',
  style,
}: {
  children: ReactNode
  width?: string
  /** Vertical alignment of the column inside the slide. */
  align?: 'center' | 'start' | 'end'
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: align === 'center' ? 'center' : align === 'start' ? 'flex-start' : 'flex-end',
        justifyContent: 'center',
        padding: 'max(28px, 6vh) max(20px, 3vw)',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative', width, maxWidth: '100%', maxHeight: '86svh', ...style }}>
        {children}
      </div>
    </div>
  )
}
