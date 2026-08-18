'use client'

import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import type { VizRenderProps } from '@vismay/viz-engine'
import { useIsMobile } from '@vismay/viz-engine'
import type { HeroConfig } from './index'
import GhostNumeral from '../../lib/GhostNumeral'
import { renderEmphasis, Chip } from '../../lib/text'
import { FONT, GREEN, INK, ON_DARK, PAPER } from '../../lib/tokens'

const TITLE_SIZE = 'clamp(30px, 4.6vw, 54px)'
// Portrait floor: Syne is a wide face — at 30px a single long word
// ("Sustainability,") outruns the ~300px stacked-panel column and gets
// clipped by the panel's overflow. 24px keeps the longest corpus words
// inside the measure on a 390px viewport.
const TITLE_SIZE_MOBILE = 'clamp(24px, 7vw, 30px)'

function TopStrip({ brand, issueRef, onGreen }: { brand: string; issueRef: string; onGreen?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: `1px solid ${ON_DARK.hairline}`,
        fontFamily: FONT.mono,
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.18em',
        color: onGreen ? ON_DARK.full : GREEN.light,
      }}
    >
      <span>{brand}</span>
      <span style={{ color: ON_DARK.secondary }}>{issueRef}</span>
    </div>
  )
}

function TitleBlock({
  config,
  align = 'left',
  isMobile = false,
}: {
  config: HeroConfig
  align?: 'left' | 'center'
  isMobile?: boolean
}) {
  return (
    <div style={{ textAlign: align }}>
      <h1
        style={{
          fontFamily: FONT.display,
          fontWeight: 800,
          fontSize: isMobile ? TITLE_SIZE_MOBILE : TITLE_SIZE,
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          color: ON_DARK.full,
          margin: 0,
        }}
      >
        {renderEmphasis(config.title, GREEN.light)}
      </h1>
      {config.subtitle ? (
        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: 'italic',
            fontSize: 'clamp(15px, 1.6vw, 19px)',
            lineHeight: 1.5,
            color: ON_DARK.body,
            marginTop: 18,
            maxWidth: '46ch',
            marginLeft: align === 'center' ? 'auto' : 0,
            marginRight: align === 'center' ? 'auto' : 0,
          }}
        >
          {config.subtitle}
        </p>
      ) : null}
      {config.tags.length > 0 ? (
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginTop: 22,
            justifyContent: align === 'center' ? 'center' : 'flex-start',
          }}
        >
          {config.tags.map((tag) => (
            <Chip key={tag} text={tag} color={ON_DARK.body} borderColor={ON_DARK.hairline} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function IssuePanel({ config }: { config: HeroConfig }) {
  return (
    <div
      style={{
        position: 'relative',
        background: GREEN.base,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: 24,
        minWidth: 0,
      }}
    >
      {config.issueNumber ? (
        <GhostNumeral
          text={config.issueNumber}
          onDark
          size="clamp(120px, 16vw, 230px)"
          style={{ right: -18, top: -14, color: 'rgba(255,255,255,0.12)' }}
        />
      ) : null}
      <div style={{ position: 'relative', fontFamily: FONT.mono, textTransform: 'uppercase' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', color: ON_DARK.secondary }}>
          {config.issueLabel}
        </div>
        {config.issueNumber ? (
          <div
            style={{
              fontFamily: FONT.display,
              fontWeight: 800,
              fontSize: 44,
              lineHeight: 1,
              color: ON_DARK.full,
              margin: '6px 0',
            }}
          >
            {config.issueNumber}
          </div>
        ) : null}
        {config.issueDate ? (
          <div style={{ fontSize: 10, letterSpacing: '0.16em', color: ON_DARK.body }}>
            {config.issueDate}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function HeroComponent({ config, noteReady }: VizRenderProps<HeroConfig>) {
  useEffect(() => {
    noteReady()
  }, [noteReady])

  const issueRef = [
    config.issueNumber ? `${config.issueLabel} ${config.issueNumber}` : null,
    config.issueDate ?? null,
  ]
    .filter(Boolean)
    .join(' · ')

  const frame: CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'max(24px, 4vh) max(20px, 3vw)',
  }

  // Corpus behavior: the split hero collapses to the stacked variant on
  // portrait (the 480px media query in every issue).
  const isMobile = useIsMobile()
  const variant = isMobile && config.variant === 'split' ? 'stacked' : config.variant
  const isBold = variant === 'bold'
  const isEditorial = variant === 'editorial'
  const isStacked = variant === 'stacked'

  // The hero paints its own panels (a two-color composition); the section's
  // gm:surface underneath should be 'dark' (or 'green' for bold) so the
  // band transition into the next section starts from the right color.
  const panelBg = isBold ? GREEN.base : INK.black

  return (
    <div style={frame}>
      <div
        style={{
          position: 'relative',
          width: 'min(1000px, 94vw)',
          maxWidth: '100%',
          maxHeight: '86svh',
          background: panelBg,
          border: `1.5px solid ${INK.black}`,
          boxShadow: `0 24px 60px rgba(14,14,12,0.28)`,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns:
            variant === 'split' ? 'minmax(0, 1fr) clamp(160px, 22vw, 240px)' : '1fr',
        }}
      >
        {isBold && config.issueNumber ? (
          <GhostNumeral
            text={config.issueNumber}
            onDark
            size="clamp(180px, 30vw, 420px)"
            style={{ right: -30, bottom: -40 }}
          />
        ) : null}

        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            padding: 'clamp(24px, 4vw, 44px)',
            gap: 'clamp(20px, 5vh, 48px)',
            minWidth: 0,
          }}
        >
          <TopStrip brand={config.brandLine} issueRef={issueRef} onGreen={isBold} />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <TitleBlock config={config} align={isEditorial || isBold ? 'center' : 'left'} isMobile={isMobile} />
          </div>
          {isStacked && issueRef ? (
            <div
              style={{
                borderTop: `1px solid ${ON_DARK.hairline}`,
                paddingTop: 14,
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: GREEN.light,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>{config.issueLabel}</span>
              <span style={{ color: ON_DARK.full }}>
                {[config.issueNumber, config.issueDate].filter(Boolean).join(' · ')}
              </span>
            </div>
          ) : null}
        </div>

        {variant === 'split' ? <IssuePanel config={config} /> : null}
      </div>
    </div>
  )
}
