import { z } from 'zod'
import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'

/**
 * `gm:standfirst` — the intro band: green-ruled off-white strip with a green
 * dot and ONE italic Instrument Serif standfirst paragraph (36/36 issues).
 */
export const standfirstSchema = z.object({
  type: z.literal('gm:standfirst'),
  text: z.string().min(1).describe('The single italic-serif standfirst paragraph.'),
  onDark: z.boolean().default(false),
})

export type StandfirstConfig = z.infer<typeof standfirstSchema>

const standfirstModule: VizModule<StandfirstConfig> = {
  type: 'gm:standfirst',
  label: 'GM standfirst',
  slots: ['foreground'],
  schema: standfirstSchema,
  parseConfig: (raw, ctx) => parseWithSchema(standfirstSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [{ kind: 'text', key: 'text', label: 'Standfirst', required: true }],
}

export default standfirstModule
