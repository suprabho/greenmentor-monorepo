'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useIsMobile } from '@vismay/viz-engine'
import { COLUMN_WIDTH } from './tokens'

/**
 * Shared slide frame: fills the unit's foreground box and centers a
 * newsletter-measure column over the full-bleed `gm:surface` band. Every
 * spine module renders inside one of these so the corpus's 680px editorial
 * column survives the move to full-viewport slides.
 *
 * Landscape: the deck layout places each slot in an absolutely positioned
 * region box, so the frame fills it with `position:absolute; inset:0`.
 *
 * Portrait: the layout stacks slots as NORMAL-FLOW children sized by their
 * content — an absolute frame contributes zero height there, collapsing the
 * band to its padding (a ~100px clipped window into the column). So on
 * portrait the frame renders in flow: the slot grows to the content, and
 * the region's own scroll container handles anything taller than the slide.
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
  const isMobile = useIsMobile()

  const outer: CSSProperties = isMobile
    ? {
        position: 'relative',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        padding: 'max(20px, 3vh) max(16px, 3vw)',
      }
    : {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems:
          align === 'center' ? 'center' : align === 'start' ? 'flex-start' : 'flex-end',
        justifyContent: 'center',
        padding: 'max(28px, 6vh) max(20px, 3vw)',
        overflow: 'hidden',
      }

  const column: CSSProperties = isMobile
    ? { position: 'relative', width, maxWidth: '100%', ...style }
    : {
        position: 'relative',
        width,
        maxWidth: '100%',
        maxHeight: '86svh',
        // Safety net: content taller than the slide scrolls inside the
        // column instead of being silently cropped. Invisible when it fits.
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        ...style,
      }

  return (
    <div style={outer}>
      <div style={column}>{children}</div>
    </div>
  )
}
