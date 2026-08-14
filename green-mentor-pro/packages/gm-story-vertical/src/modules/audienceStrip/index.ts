import { z } from 'zod'
import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'

/**
 * `gm:audienceStrip` — the pale-green "Resonates with" chips band. Every
 * corpus issue has exactly 4 chips, so the schema enforces it.
 */
export const audienceStripSchema = z.object({
  type: z.literal('gm:audienceStrip'),
  label: z.string().default('Resonates with'),
  chips: z.array(z.string().min(1)).length(4).describe('Exactly 4 audience chips.'),
})

export type AudienceStripConfig = z.infer<typeof audienceStripSchema>

const audienceStripModule: VizModule<AudienceStripConfig> = {
  type: 'gm:audienceStrip',
  label: 'GM audience strip',
  slots: ['foreground'],
  schema: audienceStripSchema,
  parseConfig: (raw, ctx) => parseWithSchema(audienceStripSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [
    { kind: 'text', key: 'label', label: 'Label' },
    { kind: 'json', key: 'chips', label: 'Chips (exactly 4)' },
  ],
}

export default audienceStripModule
