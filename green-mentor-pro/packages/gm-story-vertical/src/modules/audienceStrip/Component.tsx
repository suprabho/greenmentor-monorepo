'use client'

import { useEffect } from 'react'
import type { VizRenderProps } from '@vismay/viz-engine'
import type { AudienceStripConfig } from './index'
import Band from '../../lib/Band'
import { Chip, Eyebrow } from '../../lib/text'
import { GREEN, INK } from '../../lib/tokens'

/** Rendered over a `gm:surface` tone: 'pale' band (the corpus convention). */
export default function AudienceStripComponent({
  config,
  noteReady,
}: VizRenderProps<AudienceStripConfig>) {
  useEffect(() => {
    noteReady()
  }, [noteReady])

  return (
    <Band>
      <Eyebrow text={config.label} accent={GREEN.base} color={INK.muted} style={{ marginBottom: 20 }} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {config.chips.map((chip) => (
          <Chip key={chip} text={chip} color={INK.black} borderColor={INK.black} background="rgba(255,255,255,0.5)" />
        ))}
      </div>
    </Band>
  )
}
