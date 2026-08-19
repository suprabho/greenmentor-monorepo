'use client'

import { useEffect } from 'react'
import type { VizRenderProps } from '@vismay/viz-engine'
import { useIsMobile } from '@vismay/viz-engine'
import type { ScoreDonutConfig } from './index'
import Band from '../../lib/Band'
import { Eyebrow, renderEmphasis } from '../../lib/text'
import { useCountUp, useGmMotion } from '../../lib/useGmMotion'
import { accentFor, COLUMN_WIDTH, FONT, inkFor } from '../../lib/tokens'

const R = 54
const CIRC = 2 * Math.PI * R

/**
 * The numeral lives INSIDE the SVG, in the same 128-unit space as the ring, so
 * it scales with the ring instead of against the wrapper's font-size — an HTML
 * overlay sized in `vw` overflows the ring the moment the score has decimals.
 *
 * The ring's inner circle is 98 units across, and Syne at weight 800 advances
 * roughly 0.93em per digit, so a string of `chars` fits when
 * `chars * 0.93 * size <= 76`, which keeps a comfortable margin between the last
 * glyph and the arc even where the arc runs closest to the numeral (3 o'clock).
 * Hence `82 / chars`, capped at 32 so a two-digit score doesn't tower.
 */
function numeralSize(chars: number): number {
  return Math.min(32, 82 / Math.max(1, chars))
}

export default function ScoreDonutComponent({
  config,
  mode,
  isActive,
  noteReady,
}: VizRenderProps<ScoreDonutConfig>) {
  useEffect(() => {
    noteReady()
  }, [noteReady])

  const { animate, revealed } = useGmMotion(mode, isActive)
  const isMobile = useIsMobile()
  const ink = inkFor(config.onDark)
  const accent = accentFor(config.onDark)

  // One count-up drives both the numeral and the arc, so they can never disagree.
  const shown = useCountUp(config.value, animate, revealed)
  const fraction = config.max > 0 ? Math.max(0, Math.min(1, shown / config.max)) : 0
  const decimals = Number.isInteger(config.value) ? 0 : String(config.value).split('.')[1]?.length ?? 1
  const numeral = shown.toFixed(decimals)

  return (
    <Band width={COLUMN_WIDTH}>
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
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: isMobile ? 18 : 'clamp(20px, 3vw, 44px)',
        }}
      >
        <svg
          viewBox="0 0 128 128"
          role="img"
          aria-label={`${numeral} out of ${config.max}`}
          style={{ width: isMobile ? 150 : 'clamp(150px, 15vw, 200px)', flexShrink: 0, display: 'block' }}
        >
          {/* Only the ring rotates, so the text below stays upright. */}
          <g transform="rotate(-90 64 64)">
            <circle cx="64" cy="64" r={R} fill="none" stroke={ink.hairline} strokeWidth="10" />
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              stroke={accent}
              strokeWidth="10"
              strokeLinecap="butt"
              strokeDasharray={CIRC}
              // Driven by the dash offset, so the settled frame is a pure function of
              // the count-up — the capture path renders the final arc without waiting
              // for an animation to complete.
              strokeDashoffset={CIRC * (1 - fraction)}
            />
          </g>
          <text
            x="64"
            y="60"
            textAnchor="middle"
            dominantBaseline="central"
            fill={ink.full}
            style={{
              fontFamily: FONT.display,
              fontWeight: 800,
              fontSize: numeralSize(numeral.length),
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {numeral}
          </text>
          <text
            x="64"
            y="84"
            textAnchor="middle"
            dominantBaseline="central"
            fill={ink.secondary}
            style={{ fontFamily: FONT.mono, fontSize: 9, letterSpacing: '0.16em' }}
          >
            {`/ ${config.max}`}
          </text>
        </svg>
        <div style={{ minWidth: 0 }}>
          {config.label ? (
            <p
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: accent,
                margin: '0 0 10px',
              }}
            >
              {config.label}
            </p>
          ) : null}
          {config.note ? (
            <p
              style={{
                fontFamily: FONT.display,
                fontWeight: 400,
                fontSize: 'clamp(14px, 1.1vw, 17px)',
                lineHeight: 1.7,
                color: ink.body,
                margin: 0,
                maxWidth: '34ch',
              }}
            >
              {config.note}
            </p>
          ) : null}
        </div>
      </div>
    </Band>
  )
}
