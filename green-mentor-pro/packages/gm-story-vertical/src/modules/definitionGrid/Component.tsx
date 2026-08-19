'use client'

import { useEffect } from 'react'
import type { VizRenderProps } from '@vismay/viz-engine'
import { useIsMobile } from '@vismay/viz-engine'
import type { DefinitionGridConfig } from './index'
import Band from '../../lib/Band'
import { Eyebrow, renderEmphasis } from '../../lib/text'
import { useGmMotion } from '../../lib/useGmMotion'
import { accentFor, COLUMN_WIDE, FONT, inkFor } from '../../lib/tokens'

export default function DefinitionGridComponent({
  config,
  mode,
  isActive,
  noteReady,
}: VizRenderProps<DefinitionGridConfig>) {
  useEffect(() => {
    noteReady()
  }, [noteReady])

  const { animate, revealed } = useGmMotion(mode, isActive)
  const isMobile = useIsMobile()
  const ink = inkFor(config.onDark)
  const accent = accentFor(config.onDark)
  // Two columns only once there are enough pairs to balance them; the corpus's
  // 480px query collapses every grid to one.
  const cols = isMobile ? 1 : config.columns ?? (config.items.length > 3 ? 2 : 1)

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
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          columnGap: isMobile ? 0 : 'clamp(20px, 2.6vw, 44px)',
          margin: 0,
        }}
      >
        {config.items.map((item, i) => (
          <div
            key={i}
            style={{
              borderTop: `1px solid ${ink.hairline}`,
              padding: isMobile ? '11px 0' : 'clamp(12px, 1.5vh, 18px) 0',
              opacity: revealed ? 1 : 0,
              transform: revealed ? 'none' : 'translateY(10px)',
              transition: animate
                ? `opacity 400ms ease ${i * 90}ms, transform 400ms ease ${i * 90}ms`
                : 'none',
            }}
          >
            <dt
              style={{
                fontFamily: FONT.display,
                fontWeight: 700,
                fontSize: 'clamp(14px, 1.15vw, 17px)',
                color: ink.full,
                marginBottom: 5,
              }}
            >
              {item.term}
            </dt>
            <dd
              style={{
                margin: 0,
                fontFamily: FONT.display,
                fontWeight: 400,
                fontSize: 'clamp(13px, 1vw, 15px)',
                lineHeight: 1.65,
                color: ink.body,
              }}
            >
              {item.definition}
            </dd>
          </div>
        ))}
      </dl>
    </Band>
  )
}
