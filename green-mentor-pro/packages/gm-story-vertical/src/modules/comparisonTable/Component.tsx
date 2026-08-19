'use client'

import { useEffect } from 'react'
import type { VizRenderProps } from '@vismay/viz-engine'
import { useIsMobile } from '@vismay/viz-engine'
import type { ComparisonTableConfig } from './index'
import Band from '../../lib/Band'
import { Eyebrow, renderEmphasis } from '../../lib/text'
import { useGmMotion } from '../../lib/useGmMotion'
import { accentFor, COLUMN_WIDE, FONT, inkFor } from '../../lib/tokens'

export default function ComparisonTableComponent({
  config,
  mode,
  isActive,
  noteReady,
}: VizRenderProps<ComparisonTableConfig>) {
  useEffect(() => {
    noteReady()
  }, [noteReady])

  const { animate, revealed } = useGmMotion(mode, isActive)
  const isMobile = useIsMobile()
  const ink = inkFor(config.onDark)
  const accent = accentFor(config.onDark)
  // The 'answer' column gets a translucent green wash rather than a flat token:
  // a solid green-ultra is invisible on a `tint` band (the band IS green-ultra),
  // so the highlight has to composite over whatever surface it lands on.
  const tint = config.onDark ? 'rgba(92,184,112,0.14)' : 'rgba(44,110,63,0.08)'

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
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {config.columns.map((col, ci) => (
              <th
                key={ci}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: ink.secondary,
                  textAlign: 'left',
                  padding: isMobile ? '0 8px 8px' : '0 clamp(8px, 1vw, 16px) 10px',
                  borderBottom: `1.5px solid ${config.onDark ? ink.hairline : ink.full}`,
                  background: ci === config.highlightColumn ? tint : undefined,
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {config.rows.map((row, ri) => (
            <tr
              key={ri}
              style={{
                opacity: revealed ? 1 : 0,
                transition: animate ? `opacity 380ms ease ${ri * 110}ms` : 'none',
              }}
            >
              {config.columns.map((_col, ci) => (
                <td
                  key={ci}
                  style={{
                    fontFamily: FONT.display,
                    // The first column names the row, so it carries the ink weight;
                    // the rest are values in the softer body colour.
                    fontWeight: ci === 0 ? 600 : 400,
                    fontSize: 'clamp(13px, 1vw, 15px)',
                    lineHeight: 1.6,
                    color: ci === 0 ? ink.full : ink.body,
                    padding: isMobile ? '9px 8px' : 'clamp(10px, 1.3vh, 15px) clamp(8px, 1vw, 16px)',
                    borderBottom: `1px solid ${ink.hairline}`,
                    background: ci === config.highlightColumn ? tint : undefined,
                    verticalAlign: 'top',
                  }}
                >
                  {row[ci] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Band>
  )
}
