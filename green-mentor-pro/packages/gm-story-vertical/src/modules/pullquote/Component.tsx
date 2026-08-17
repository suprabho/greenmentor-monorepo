'use client'

import { useEffect } from 'react'
import type { VizRenderProps } from '@vismay/viz-engine'
import type { PullquoteConfig } from './index'
import Band from '../../lib/Band'
import GhostNumeral from '../../lib/GhostNumeral'
import { FONT, ON_DARK } from '../../lib/tokens'

/** Rendered over a `gm:surface` tone: 'green' band (the corpus convention). */
export default function PullquoteComponent({ config, noteReady }: VizRenderProps<PullquoteConfig>) {
  useEffect(() => {
    noteReady()
  }, [noteReady])

  return (
    <Band>
      <GhostNumeral
        text="“"
        onDark
        size="clamp(140px, 20vw, 260px)"
        style={{ left: -20, top: -50 }}
      />
      <blockquote style={{ position: 'relative', margin: 0, padding: '40px 0 0' }}>
        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: 'italic',
            fontSize: 'clamp(22px, 2.8vw, 32px)',
            lineHeight: 1.45,
            color: ON_DARK.full,
            margin: 0,
          }}
        >
          {config.text}
        </p>
        {config.attribution ? (
          <footer
            style={{
              marginTop: 26,
              fontFamily: FONT.mono,
              fontSize: 10.5,
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              color: ON_DARK.body,
            }}
          >
            — {config.attribution}
          </footer>
        ) : null}
      </blockquote>
    </Band>
  )
}
