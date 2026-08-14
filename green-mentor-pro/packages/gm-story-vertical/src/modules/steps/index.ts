import { z } from 'zod'
import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'

/**
 * `gm:steps` — numbered sequence inside one hairline container. Consolidates
 * the corpus's four competing vocabularies (steps-list/step-row, step-item,
 * phase-list/phase-card, roadmap/rm-step) into one module.
 */
export const stepsSchema = z.object({
  type: z.literal('gm:steps'),
  eyebrow: z.string().optional(),
  title: z.string().optional().describe('Supports *emphasis* spans.'),
  variant: z.enum(['list', 'chain']).default('list').describe('list = stacked rows; chain = horizontal nodes with arrows.'),
  steps: z
    .array(
      z.object({
        title: z.string().optional(),
        body: z.string().min(1),
      })
    )
    .min(2)
    .max(8),
  onDark: z.boolean().default(false),
})

export type StepsConfig = z.infer<typeof stepsSchema>

const stepsModule: VizModule<StepsConfig> = {
  type: 'gm:steps',
  label: 'GM step sequence',
  slots: ['foreground'],
  schema: stepsSchema,
  parseConfig: (raw, ctx) => parseWithSchema(stepsSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [
    { kind: 'text', key: 'eyebrow', label: 'Eyebrow' },
    { kind: 'text', key: 'title', label: 'Title' },
    { kind: 'json', key: 'steps', label: 'Steps ({title, body})' },
  ],
}

export default stepsModule
