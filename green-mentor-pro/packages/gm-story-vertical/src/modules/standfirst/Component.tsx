'use client'

import { useEffect } from 'react'
import type { VizRenderProps } from '@vismay/viz-engine'
import type { StandfirstConfig } from './index'
import Band from '../../lib/Band'
import { accentFor, FONT, inkFor } from '../../lib/tokens'

export default function StandfirstComponent({ config, noteReady }: VizRenderProps<StandfirstConfig>) {
  useEffect(() => {
    noteReady()
  }, [noteReady])

  const ink = inkFor(config.onDark)
  const accent = accentFor(config.onDark)

  return (
    <Band>
      <div style={{ borderTop: `3px solid ${accent}`, paddingTop: 26 }}>
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: accent,
            marginBottom: 18,
          }}
        />
        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: 'italic',
            fontSize: 'clamp(19px, 2.2vw, 26px)',
            lineHeight: 1.55,
            color: ink.full,
            margin: 0,
          }}
        >
          {config.text}
        </p>
      </div>
    </Band>
  )
}
