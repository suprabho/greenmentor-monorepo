'use client'

import { useEffect } from 'react'
import type { VizRenderProps } from '@vismay/viz-engine'
import { formatInlineMarkdown } from '@vismay/viz-engine'
import type { CalloutConfig } from './index'
import Band from '../../lib/Band'
import { Chip } from '../../lib/text'
import { FONT, GREEN, INK, inkFor, ON_DARK, PAPER, RADIUS } from '../../lib/tokens'

export default function CalloutComponent({ config, noteReady }: VizRenderProps<CalloutConfig>) {
  useEffect(() => {
    noteReady()
  }, [noteReady])

  const ink = inkFor(false) // body panel is always light paper

  return (
    <Band>
      <div
        style={{
          border: `1.5px solid ${INK.black}`,
          borderRadius: RADIUS.card,
          overflow: 'hidden',
          boxShadow: config.onDark ? '0 18px 44px rgba(14,14,12,0.35)' : undefined,
        }}
      >
        <div
          style={{
            background: INK.black,
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: FONT.display,
              fontWeight: 700,
              fontSize: 15,
              color: ON_DARK.full,
            }}
          >
            {config.title}
          </span>
          {config.badge ? (
            <Chip text={config.badge} color={GREEN.light} borderColor={GREEN.light} />
          ) : null}
        </div>
        <div style={{ background: PAPER.white, padding: '18px 20px' }}>
          {(config.paragraphs ?? []).map((p, i) => (
            <p
              key={i}
              style={{
                margin: i === 0 ? 0 : '10px 0 0',
                fontFamily: FONT.display,
                fontSize: 13.5,
                lineHeight: 1.65,
                color: ink.body,
              }}
            >
              {formatInlineMarkdown(p)}
            </p>
          ))}
          {config.items && config.items.length > 0 ? (
            <ul style={{ margin: config.paragraphs?.length ? '12px 0 0' : 0, padding: 0, listStyle: 'none' }}>
              {config.items.map((item, i) => (
                <li
                  key={i}
                  style={{
                    fontFamily: FONT.display,
                    fontSize: 13.5,
                    lineHeight: 1.7,
                    color: ink.body,
                    padding: '6px 0',
                    borderTop: i > 0 ? `1px solid ${ink.hairline}` : undefined,
                  }}
                >
                  {formatInlineMarkdown(item)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </Band>
  )
}
