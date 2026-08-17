'use client'

import { useEffect } from 'react'
import type { VizRenderProps } from '@vismay/viz-engine'
import type { StatGridConfig } from './index'
import Band from '../../lib/Band'
import { Chip, Eyebrow, renderEmphasis } from '../../lib/text'
import { useIsMobile } from '@vismay/viz-engine'
import { useCountUp, useGmMotion } from '../../lib/useGmMotion'
import { accentFor, CARD_BORDER, COLUMN_WIDE, FONT, inkFor, RADIUS } from '../../lib/tokens'

/** A value like "176" or "22.46" counts up; "~1.5x" renders as-is. */
function parseNumeric(value: string): { n: number; decimals: number } | null {
  if (!/^[0-9]+(\.[0-9]+)?$/.test(value.trim())) return null
  const n = Number(value)
  const decimals = value.includes('.') ? value.split('.')[1].length : 0
  return { n, decimals }
}

function StatValue({
  value,
  animate,
  run,
  color,
}: {
  value: string
  animate: boolean
  run: boolean
  color: string
}) {
  const numeric = parseNumeric(value)
  const current = useCountUp(numeric?.n ?? 0, animate, run && numeric !== null)
  const display = numeric ? current.toFixed(numeric.decimals) : value
  return (
    <span
      style={{
        fontFamily: FONT.display,
        fontWeight: 800,
        fontSize: 'clamp(34px, 4.4vw, 52px)',
        lineHeight: 1,
        letterSpacing: '-0.03em',
        color,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {display}
    </span>
  )
}

export default function StatGridComponent({
  config,
  mode,
  isActive,
  noteReady,
}: VizRenderProps<StatGridConfig>) {
  useEffect(() => {
    noteReady()
  }, [noteReady])

  const { animate, revealed } = useGmMotion(mode, isActive)
  const isMobile = useIsMobile()
  const ink = inkFor(config.onDark)
  const accent = accentFor(config.onDark)
  // Corpus 480px media query: stat grids collapse to a single column.
  const cols = isMobile ? 1 : config.columns ?? Math.min(config.items.length, 4)

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
        {config.items.map((item, i) => (
          <div
            key={i}
            style={{
              border: CARD_BORDER(config.onDark),
              borderRadius: RADIUS.card,
              padding: 'clamp(16px, 2vw, 26px)',
              opacity: revealed ? 1 : 0,
              transform: revealed ? 'none' : 'translateY(12px)',
              transition: animate
                ? `opacity 420ms ease ${i * 110}ms, transform 420ms ease ${i * 110}ms`
                : 'none',
            }}
          >
            {item.icon ? <div style={{ fontSize: 20, marginBottom: 10 }}>{item.icon}</div> : null}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
              <StatValue value={item.value} animate={animate} run={revealed} color={accent} />
              {item.unit ? (
                <span
                  style={{
                    fontFamily: FONT.display,
                    fontWeight: 700,
                    fontSize: 'clamp(15px, 1.6vw, 20px)',
                    color: ink.secondary,
                  }}
                >
                  {item.unit}
                </span>
              ) : null}
            </div>
            <div
              style={{
                marginTop: 10,
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: ink.full,
              }}
            >
              {item.label}
            </div>
            {item.note ? (
              <p
                style={{
                  marginTop: 8,
                  marginBottom: 0,
                  fontFamily: FONT.display,
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  color: ink.body,
                }}
              >
                {item.note}
              </p>
            ) : null}
            {item.sourceTag ? (
              <div style={{ marginTop: 10 }}>
                <Chip text={item.sourceTag} color={ink.secondary} borderColor={ink.hairline} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Band>
  )
}
