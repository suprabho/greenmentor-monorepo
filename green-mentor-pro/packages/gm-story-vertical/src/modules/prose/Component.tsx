'use client'

import { useEffect } from 'react'
import type { VizRenderProps } from '@vismay/viz-engine'
import { useForegroundContent, formatInlineMarkdown } from '@vismay/viz-engine'
import type { ProseConfig } from './index'
import Band from '../../lib/Band'
import { Eyebrow, renderEmphasis } from '../../lib/text'
import { accentFor, FONT, inkFor } from '../../lib/tokens'

export default function ProseComponent({ config, noteReady }: VizRenderProps<ProseConfig>) {
  useEffect(() => {
    noteReady()
  }, [noteReady])

  const ctx = useForegroundContent()
  const paragraphs = config.paragraphs ?? ctx?.unit?.paragraphs ?? []
  const ink = inkFor(config.onDark)
  const accent = accentFor(config.onDark)

  return (
    <Band>
      {config.eyebrow ? (
        <Eyebrow text={config.eyebrow} accent={accent} color={ink.secondary} style={{ marginBottom: 16 }} />
      ) : null}
      {config.title ? (
        <h2
          style={{
            fontFamily: FONT.display,
            fontWeight: 700,
            fontSize: 'clamp(22px, 2.6vw, 30px)',
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            color: ink.full,
            margin: '0 0 20px',
          }}
        >
          {renderEmphasis(config.title, accent)}
        </h2>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {paragraphs.map((p, i) => (
          <p
            key={i}
            style={{
              fontFamily: FONT.display,
              fontWeight: 400,
              fontSize: 'clamp(14px, 1.35vw, 16.5px)',
              lineHeight: 1.75,
              color: ink.body,
              margin: 0,
            }}
          >
            {formatInlineMarkdown(p)}
          </p>
        ))}
      </div>
    </Band>
  )
}
