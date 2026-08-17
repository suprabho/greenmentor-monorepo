'use client'

import { useEffect } from 'react'
import type { VizRenderProps } from '@vismay/viz-engine'
import { useIsMobile } from '@vismay/viz-engine'
import type { ExplainerGridConfig } from './index'
import Band from '../../lib/Band'
import { Eyebrow, renderEmphasis } from '../../lib/text'
import { useGmMotion } from '../../lib/useGmMotion'
import {
  accentFor,
  CARD_BORDER,
  COLUMN_WIDE,
  FONT,
  GREEN,
  INK,
  inkFor,
  ON_DARK,
  RADIUS,
} from '../../lib/tokens'

export default function ExplainerGridComponent({
  config,
  mode,
  isActive,
  activeStep,
  noteReady,
}: VizRenderProps<ExplainerGridConfig>) {
  useEffect(() => {
    noteReady()
  }, [noteReady])

  const { animate, revealed } = useGmMotion(mode, isActive)
  const isMobile = useIsMobile()
  const ink = inkFor(config.onDark)
  const accent = accentFor(config.onDark)
  // Corpus 480px media query: explainer grids collapse to a single column.
  const cols = isMobile ? 1 : config.columns ?? Math.min(config.cards.length, 4)

  // Autoplay sweeps the inverted cell with activeStep; otherwise it's the
  // authored activeIndex.
  const inverted =
    mode === 'autoplay' && config.cards.length > 0
      ? activeStep % config.cards.length
      : config.activeIndex

  return (
    <Band width={COLUMN_WIDE}>
      {config.eyebrow ? (
        <Eyebrow text={config.eyebrow} accent={accent} color={ink.secondary} style={{ marginBottom: 14 }} />
      ) : null}
      {config.title ? (
        <h2
          style={{
            fontFamily: FONT.display,
            fontWeight: 700,
            fontSize: 'clamp(22px, 2.6vw, 30px)',
            letterSpacing: '-0.02em',
            color: ink.full,
            margin: '0 0 24px',
          }}
        >
          {renderEmphasis(config.title, accent)}
        </h2>
      ) : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gap: 14,
        }}
      >
        {config.cards.map((card, i) => {
          const isInverted = inverted === i
          return (
            <div
              key={i}
              style={{
                border: CARD_BORDER(config.onDark),
                borderRadius: RADIUS.card,
                padding: 'clamp(16px, 2vw, 24px)',
                background: isInverted ? INK.black : 'transparent',
                opacity: revealed ? 1 : 0,
                transform: revealed ? 'none' : 'translateY(12px)',
                transition: animate
                  ? `opacity 420ms ease ${i * 110}ms, transform 420ms ease ${i * 110}ms, background-color 300ms ease`
                  : 'none',
              }}
            >
              <div
                style={{
                  fontFamily: FONT.display,
                  fontWeight: 800,
                  fontSize: 30,
                  lineHeight: 1,
                  color: isInverted ? GREEN.light : accent,
                }}
              >
                {card.number ?? String(i + 1)}
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: isInverted ? ON_DARK.full : ink.full,
                }}
              >
                {card.label}
              </div>
              <p
                style={{
                  marginTop: 8,
                  marginBottom: 0,
                  fontFamily: FONT.display,
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: isInverted ? ON_DARK.body : ink.body,
                }}
              >
                {card.description}
              </p>
            </div>
          )
        })}
      </div>
    </Band>
  )
}
