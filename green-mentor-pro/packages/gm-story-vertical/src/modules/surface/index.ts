import { z } from 'zod'
import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'

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

const surfaceModule: VizModule<SurfaceConfig> = {
  type: 'gm:surface',
  label: 'GM surface band',
  slots: ['background'],
  schema: surfaceSchema,
  parseConfig: (raw, ctx) => parseWithSchema(surfaceSchema, raw, ctx),
  load: () => import('./Component'),
  loadPersistent: () => import('./Persistent'),
  mountingMode: 'persistent-aggregated',
  // Constant identity: every unit's gm:surface layer collapses into a single
  // persistent mount that repaints per active unit.
  stableIdentity: () => 'gm:surface',
  readinessProfile: 'instant',
  adminForm: () => [
    {
      kind: 'select',
      key: 'tone',
      label: 'Band tone',
      options: [
        { value: 'light', label: 'Light (paper)' },
        { value: 'tint', label: 'Green tint' },
        { value: 'pale', label: 'Pale green' },
        { value: 'off', label: 'Off-white' },
        { value: 'dark', label: 'Dark (ink)' },
        { value: 'green', label: 'Green (brand)' },
        { value: 'page', label: 'Page grey' },
      ],
    },
  ],
}

export default surfaceModule
