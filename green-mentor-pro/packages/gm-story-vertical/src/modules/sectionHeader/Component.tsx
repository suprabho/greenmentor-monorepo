'use client'

import { useEffect } from 'react'
import type { VizRenderProps } from '@vismay/viz-engine'
import type { SectionHeaderConfig } from './index'
import Band from '../../lib/Band'
import GhostNumeral from '../../lib/GhostNumeral'
import { Eyebrow, renderEmphasis } from '../../lib/text'
import { accentFor, COLUMN_WIDE, FONT, inkFor } from '../../lib/tokens'

export default function SectionHeaderComponent({
  config,
  noteReady,
}: VizRenderProps<SectionHeaderConfig>) {
  useEffect(() => {
    noteReady()
  }, [noteReady])

  const ink = inkFor(config.onDark)
  const accent = accentFor(config.onDark)

  return (
    <Band width={COLUMN_WIDE}>
      {config.ghostNumeral ? (
        <GhostNumeral
          text={config.ghostNumeral}
          onDark={config.onDark}
          size="clamp(160px, 26vw, 340px)"
          style={{ right: -10, top: '-0.35em' }}
        />
      ) : null}
      <div style={{ position: 'relative' }}>
        {config.eyebrow ? (
          <Eyebrow text={config.eyebrow} accent={accent} color={ink.secondary} style={{ marginBottom: 18 }} />
        ) : null}
        <h2
          style={{
            fontFamily: FONT.display,
            fontWeight: 800,
            fontSize: 'clamp(28px, 4vw, 46px)',
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
            color: ink.full,
            margin: 0,
            maxWidth: '20ch',
          }}
        >
          {renderEmphasis(config.title, accent)}
        </h2>
      </div>
    </Band>
  )
}
