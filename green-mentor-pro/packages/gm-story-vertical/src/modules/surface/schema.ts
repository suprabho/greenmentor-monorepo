import { z } from 'zod'

/**
 * `gm:surface` — the band-rhythm mechanism.
 *
 * Every GreenMentor section declares one of these in its `background:`. The
 * module mounts as ONE persistent instance for the whole story
 * (`persistent-aggregated` + constant `stableIdentity`), receives every
 * unit's config, and CSS-transitions its background color as `activeUnit`
 * moves — which is exactly the corpus's alternating full-bleed color bands,
 * animated for free at scroll-snap boundaries.
 */
export const surfaceSchema = z.object({
  type: z.literal('gm:surface'),
  tone: z
    .enum(['light', 'tint', 'pale', 'off', 'dark', 'green', 'page'])
    .default('light')
    .describe(
      'Band color: light #f7f6f2 · tint #eaf5ec · pale #d4edda · off #eeede8 · dark #0e0e0c · green #2c6e3f · page #d8d6cf. Alternate tones between sections; never repeat dark twice in a row.'
    ),
})

export type SurfaceConfig = z.infer<typeof surfaceSchema>
