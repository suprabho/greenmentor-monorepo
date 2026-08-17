'use client'

import { useEffect } from 'react'
import type { VizPersistentRenderProps } from '@vismay/viz-engine'
import type { SurfaceConfig } from './index'
import { SURFACE_COLOR } from '../../lib/tokens'

/**
 * Single persistent background for the whole story. Repaints (with a CSS
 * transition in live scroll) as the active unit's band tone changes. Units
 * with no gm:surface layer fall back to the previous tone so a missing band
 * never flashes to transparent.
 */
export default function SurfacePersistent({
  configs,
  activeUnit,
  mode,
  noteReady,
}: VizPersistentRenderProps<SurfaceConfig>) {
  useEffect(() => {
    noteReady()
  }, [noteReady])

  // Active tone: current unit's config, else nearest earlier unit's.
  let tone: SurfaceConfig['tone'] = 'light'
  for (let i = Math.min(activeUnit, configs.length - 1); i >= 0; i--) {
    const c = configs[i]
    if (c) {
      tone = c.tone
      break
    }
  }

  return (
    <div
      data-gm-surface={tone}
      style={{
        position: 'absolute',
        inset: 0,
        background: SURFACE_COLOR[tone],
        transition: mode === 'scroll' ? 'background-color 600ms ease' : 'none',
      }}
    />
  )
}
