'use client'

import { useEffect } from 'react'
import type { VizRenderProps } from '@vismay/viz-engine'
import type { TakeawaysConfig } from './index'
import Band from '../../lib/Band'
import { Eyebrow, renderEmphasis } from '../../lib/text'
import { useGmMotion } from '../../lib/useGmMotion'
import { FONT, GREEN, ON_DARK } from '../../lib/tokens'

/** Rendered over a `gm:surface` tone: 'dark' band (the corpus convention). */
export default function TakeawaysComponent({
  config,
  mode,
  isActive,
  noteReady,
}: VizRenderProps<TakeawaysConfig>) {
  useEffect(() => {
    noteReady()
  }, [noteReady])

  const { animate, revealed } = useGmMotion(mode, isActive)

  return (
    <Band>
      <Eyebrow text={config.eyebrow} accent={GREEN.light} color={ON_DARK.secondary} style={{ marginBottom: 16 }} />
      {config.title ? (
        <h2
          style={{
            fontFamily: FONT.display,
            fontWeight: 700,
            fontSize: 'clamp(22px, 2.6vw, 30px)',
            letterSpacing: '-0.02em',
            color: ON_DARK.full,
            margin: '0 0 26px',
          }}
        >
          {renderEmphasis(config.title, GREEN.light)}
        </h2>
      ) : null}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
        {config.items.map((item, i) => (
          <li
            key={i}
            style={{
              display: 'flex',
              gap: 18,
              alignItems: 'baseline',
              padding: '16px 0',
              borderTop: `1px solid ${ON_DARK.hairline}`,
              opacity: revealed ? 1 : 0,
              transform: revealed ? 'none' : 'translateY(14px)',
              transition: animate
                ? `opacity 480ms ease ${i * 90}ms, transform 480ms ease ${i * 90}ms`
                : 'none',
            }}
          >
            <span
              style={{
                fontFamily: FONT.display,
                fontWeight: 800,
                fontSize: 22,
                color: GREEN.light,
                minWidth: 34,
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <p style={{ margin: 0, fontFamily: FONT.display, fontSize: 'clamp(14px, 1.35vw, 16px)', lineHeight: 1.65 }}>
              <strong style={{ color: ON_DARK.full, fontWeight: 700 }}>{item.lead}</strong>
              {item.body ? <span style={{ color: ON_DARK.body }}> {item.body}</span> : null}
            </p>
          </li>
        ))}
      </ol>
    </Band>
  )
}
