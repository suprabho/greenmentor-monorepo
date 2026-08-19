'use client'

import { useEffect } from 'react'
import type { VizRenderProps } from '@vismay/viz-engine'
import type { CtaConfig } from './index'
import Band from '../../lib/Band'
import { Eyebrow, renderEmphasis } from '../../lib/text'
import { useGmMotion } from '../../lib/useGmMotion'
import { accentFor, CARD_BORDER, COLUMN_WIDTH, FONT, inkFor, RADIUS } from '../../lib/tokens'

export default function CtaComponent({
  config,
  mode,
  isActive,
  noteReady,
}: VizRenderProps<CtaConfig>) {
  useEffect(() => {
    noteReady()
  }, [noteReady])

  const { animate, revealed } = useGmMotion(mode, isActive)
  const ink = inkFor(config.onDark)
  const accent = accentFor(config.onDark)

  return (
    <Band width={COLUMN_WIDTH}>
      <div
        style={{
          border: CARD_BORDER(config.onDark),
          borderRadius: RADIUS.card,
          padding: 'clamp(24px, 3vw, 38px)',
          opacity: animate && !revealed ? 0 : 1,
          transform: animate && !revealed ? 'translateY(10px)' : 'none',
          transition: animate ? 'opacity 520ms ease, transform 520ms ease' : undefined,
        }}
      >
        {config.eyebrow ? (
          <Eyebrow text={config.eyebrow} accent={accent} color={ink.secondary} style={{ marginBottom: 14 }} />
        ) : null}
        <h2
          style={{
            fontFamily: FONT.display,
            fontWeight: 700,
            fontSize: 'clamp(22px, 2.8vw, 32px)',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            color: ink.full,
            margin: 0,
            maxWidth: '22em',
          }}
        >
          {renderEmphasis(config.title, accent)}
        </h2>
        {config.body ? (
          <p
            style={{
              fontFamily: FONT.display,
              fontWeight: 400,
              fontSize: 'clamp(14px, 1.15vw, 17px)',
              lineHeight: 1.7,
              color: ink.body,
              margin: '14px 0 0',
              maxWidth: '46ch',
            }}
          >
            {config.body}
          </p>
        ) : null}
        <a
          href={config.actionHref}
          style={{
            display: 'inline-block',
            marginTop: 24,
            fontFamily: FONT.mono,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: config.onDark ? '#0e0e0c' : '#ffffff',
            background: accent,
            borderRadius: RADIUS.pill,
            padding: '13px 26px',
            textDecoration: 'none',
          }}
        >
          {config.actionLabel}
        </a>
        {config.note ? (
          <p
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: '0.06em',
              color: ink.secondary,
              margin: '14px 0 0',
            }}
          >
            {config.note}
          </p>
        ) : null}
      </div>
    </Band>
  )
}
