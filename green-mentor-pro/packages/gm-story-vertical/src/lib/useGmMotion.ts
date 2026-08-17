'use client'

import { useEffect, useRef, useState } from 'react'
import type { VizRenderProps } from '@vismay/viz-engine'

/**
 * One shared gate for every gm:* animation.
 *
 * Rule: motion runs ONLY in live scroll mode without reduced-motion. Capture,
 * print and autoplay render the final state immediately with zero timers —
 * the PDF/video pipelines depend on deterministic first paint (same contract
 * as `?capture=1` in StoryShell).
 */
export function useGmMotion(mode: VizRenderProps<unknown>['mode'], isActive: boolean) {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const animate = mode === 'scroll' && !reduced
  // A block "arms" the first time its unit becomes active in an animatable
  // mode; it never re-runs its entrance on re-visits (corpus-style calm).
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (isActive) setArmed(true)
  }, [isActive])

  return { animate, revealed: !animate || armed }
}

/**
 * rAF count-up for stat figures. Returns the display value; jumps straight to
 * `target` when `animate` is false (capture/print/reduced-motion).
 */
export function useCountUp(target: number, animate: boolean, run: boolean, durationMs = 900): number {
  const [value, setValue] = useState(animate ? 0 : target)
  const started = useRef(false)

  useEffect(() => {
    if (!animate) {
      setValue(target)
      return
    }
    if (!run || started.current) return
    started.current = true
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / durationMs)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(target * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate, run, target, durationMs])

  return value
}
