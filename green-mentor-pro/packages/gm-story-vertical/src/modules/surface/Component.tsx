'use client'

import { useEffect } from 'react'
import type { VizRenderProps } from '@vismay/viz-engine'
import type { SurfaceConfig } from './index'
import { SURFACE_COLOR } from '../../lib/tokens'

/**
 * Per-unit fallback render (used only if a host mounts gm:surface outside the
 * persistent-aggregated path, e.g. a single-section capture frame). Paints the
 * band color with no transition.
 */
export default function SurfaceComponent({ config, noteReady }: VizRenderProps<SurfaceConfig>) {
  useEffect(() => {
    noteReady()
  }, [noteReady])

  return (
    <div
      data-gm-surface={config.tone}
      style={{ position: 'absolute', inset: 0, background: SURFACE_COLOR[config.tone] }}
    />
  )
}
