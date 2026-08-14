'use client'

import { useEffect } from 'react'
import type { VizRenderProps } from '@vismay/viz-engine'
import { useIsMobile } from '@vismay/viz-engine'
import type { StepsConfig } from './index'
import Band from '../../lib/Band'
import { Eyebrow, renderEmphasis } from '../../lib/text'
import { useGmMotion } from '../../lib/useGmMotion'
import { accentFor, CARD_BORDER, FONT, inkFor, RADIUS } from '../../lib/tokens'

export default function StepsComponent({
  config,
  mode,
  isActive,
  noteReady,
}: VizRenderProps<StepsConfig>) {
  useEffect(() => {
    noteReady()
  }, [noteReady])

  const { animate, revealed } = useGmMotion(mode, isActive)
  const isMobile = useIsMobile()
  const ink = inkFor(config.onDark)
  const accent = accentFor(config.onDark)
  // Chains stack vertically on portrait (corpus grids collapse at 480px).
  const isChain = config.variant === 'chain' && !isMobile

  return (
    <Band>
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
            margin: '0 0 22px',
          }}
        >
          {renderEmphasis(config.title, accent)}
        </h2>
      ) : null}

      <div
        style={{
          border: CARD_BORDER(config.onDark),
          borderRadius: RADIUS.card,
          display: 'flex',
          flexDirection: isChain ? 'row' : 'column',
          alignItems: isChain ? 'stretch' : undefined,
          overflow: 'hidden',
        }}
      >
        {config.steps.map((step, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: isChain ? 'column' : 'row',
              gap: isChain ? 10 : 16,
              alignItems: 'baseline',
              flex: isChain ? 1 : undefined,
              padding: 'clamp(12px, 1.4vw, 18px) clamp(14px, 1.8vw, 22px)',
              borderTop: !isChain && i > 0 ? `1px solid ${ink.hairline}` : undefined,
              borderLeft: isChain && i > 0 ? `1px solid ${ink.hairline}` : undefined,
              opacity: revealed ? 1 : 0,
              transform: revealed ? 'none' : 'translateY(10px)',
              transition: animate
                ? `opacity 380ms ease ${i * 80}ms, transform 380ms ease ${i * 80}ms`
                : 'none',
            }}
          >
            <span
              style={{
                fontFamily: FONT.display,
                fontWeight: 800,
                fontSize: 18,
                color: accent,
                minWidth: isChain ? undefined : 30,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <div style={{ minWidth: 0 }}>
              {step.title ? (
                <div
                  style={{
                    fontFamily: FONT.display,
                    fontWeight: 700,
                    fontSize: 'clamp(13.5px, 1.3vw, 15.5px)',
                    color: ink.full,
                    marginBottom: 3,
                  }}
                >
                  {step.title}
                </div>
              ) : null}
              <p
                style={{
                  margin: 0,
                  fontFamily: FONT.display,
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  color: ink.body,
                }}
              >
                {step.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Band>
  )
}
