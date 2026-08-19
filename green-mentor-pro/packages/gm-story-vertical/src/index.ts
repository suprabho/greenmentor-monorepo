/**
 * GreenMentor story vertical — `gm:*` viz modules for scrollytelling stories.
 *
 * Design language extracted from the GreenMentor newsletter corpus (~34
 * issues, one template family): Syne display, Instrument Serif italic
 * editorial voice, DM Mono meta, alternating full-bleed surface bands.
 *
 * Registration follows the vismay vertical contract: hosts call
 *   registerVerticalLoader('greenmentor', () => import('@gm/story-vertical').then(m => m.register()))
 * and stories opt in via frontmatter `vertical: 'greenmentor'`.
 *
 * `register()` is idempotent — the engine registry throws on duplicate types
 * and HMR/remounts re-run registration, so every module is guarded.
 */

import { getVizModule, registerVizModule, type VizModule } from '@vismay/viz-engine'

// The registry's own AnyVizModule alias is module-private; mirror it here.
type AnyVizModule = VizModule<any>

export { GREENMENTOR_THEME, gmFontImportUrl } from './theme'
export { surfaceInk, SURFACE_COLOR, type SurfaceTone } from './lib/tokens'
export { lintGmStory, isGmForegroundType, type GmLintIssue } from './lib/lintGmStory'
export { applyGmBandRhythm } from './lib/applyGmBandRhythm'
export { completeGmCoverBody } from './lib/completeGmCover'

function registerSafely(module: AnyVizModule): void {
  if (!getVizModule(module.type)) registerVizModule(module)
}

/** Idempotently register every gm:* module (and nothing else). */
export async function registerGmStoryModules(): Promise<void> {
  const modules = await Promise.all([
    import('./modules/surface'),
    import('./modules/hero'),
    import('./modules/standfirst'),
    import('./modules/sectionHeader'),
    import('./modules/prose'),
    import('./modules/pullquote'),
    import('./modules/takeaways'),
    import('./modules/audienceStrip'),
    import('./modules/footer'),
    import('./modules/statGrid'),
    import('./modules/explainerGrid'),
    import('./modules/steps'),
    import('./modules/callout'),
    import('./modules/comparisonTable'),
    import('./modules/definitionGrid'),
    import('./modules/scoreDonut'),
    import('./modules/cta'),
  ])
  for (const m of modules) registerSafely(m.default as AnyVizModule)
}

/** Vertical-loader entry point (vismay contract). */
export async function register(): Promise<void> {
  await registerGmStoryModules()
}
