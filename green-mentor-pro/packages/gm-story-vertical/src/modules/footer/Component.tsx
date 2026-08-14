'use client'

import { useEffect } from 'react'
import type { VizRenderProps } from '@vismay/viz-engine'
import { useIsMobile } from '@vismay/viz-engine'
import type { FooterConfig } from './index'
import Band from '../../lib/Band'
import { FONT, GREEN, ON_DARK } from '../../lib/tokens'

/** Rendered over a `gm:surface` tone: 'dark' band. */
export default function FooterComponent({ config, noteReady }: VizRenderProps<FooterConfig>) {
  useEffect(() => {
    noteReady()
  }, [noteReady])

  const isMobile = useIsMobile()

  return (
    <Band>
      {config.closingNote ? (
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          {config.closingNote.emoji ? (
            <div style={{ fontSize: 30, marginBottom: 12 }}>{config.closingNote.emoji}</div>
          ) : null}
          <p
            style={{
              fontFamily: FONT.serif,
              fontStyle: 'italic',
              fontSize: 'clamp(16px, 1.8vw, 20px)',
              lineHeight: 1.6,
              color: ON_DARK.body,
              margin: 0,
            }}
          >
            {config.closingNote.text}
          </p>
          {config.closingNote.signature ? (
            <p
              style={{
                marginTop: 10,
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: ON_DARK.secondary,
              }}
            >
              {config.closingNote.signature}
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          fontFamily: FONT.display,
          fontWeight: 800,
          fontSize: 24,
          letterSpacing: '-0.02em',
          color: ON_DARK.full,
        }}
      >
        {config.logo}
        <span style={{ color: GREEN.light }}>.</span>
      </div>
      {config.tagline ? (
        <p
          style={{
            marginTop: 6,
            marginBottom: 0,
            fontFamily: FONT.serif,
            fontStyle: 'italic',
            fontSize: 14.5,
            color: ON_DARK.secondary,
          }}
        >
          {config.tagline}
        </p>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
          gap: isMobile ? 16 : 24,
          marginTop: 34,
          paddingTop: 24,
          borderTop: `1px solid ${ON_DARK.hairline}`,
        }}
      >
        {config.columns.map((col) => (
          <div key={col.label}>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 9.5,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: GREEN.light,
                marginBottom: 8,
              }}
            >
              {col.label}
            </div>
            <div
              style={{
                fontFamily: FONT.display,
                fontSize: 13,
                lineHeight: 1.6,
                color: ON_DARK.body,
              }}
            >
              {col.body}
            </div>
          </div>
        ))}
      </div>

      {config.copyright ? (
        <div
          style={{
            marginTop: 30,
            paddingTop: 18,
            borderTop: `1px solid ${ON_DARK.hairline}`,
            fontFamily: FONT.mono,
            fontSize: 9.5,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: ON_DARK.secondary,
          }}
        >
          {config.copyright}
        </div>
      ) : null}
    </Band>
  )
}
