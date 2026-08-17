import { z } from 'zod'
import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'

/**
 * `gm:callout` — black header bar with title + green badge chip over a light
 * body (26/36 issues). Body is either paragraphs or a compact list.
 */
export const calloutSchema = z.object({
  type: z.literal('gm:callout'),
  title: z.string().min(1),
  badge: z.string().optional().describe("Short uppercase chip in the header, e.g. 'Example'."),
  paragraphs: z.array(z.string()).optional(),
  items: z.array(z.string()).optional().describe('Compact list items (rendered with markers).'),
  onDark: z.boolean().default(false),
})

export type CalloutConfig = z.infer<typeof calloutSchema>

const calloutModule: VizModule<CalloutConfig> = {
  type: 'gm:callout',
  label: 'GM callout box',
  slots: ['foreground'],
  schema: calloutSchema,
  parseConfig: (raw, ctx) => parseWithSchema(calloutSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [
    { kind: 'text', key: 'title', label: 'Title', required: true },
    { kind: 'text', key: 'badge', label: 'Badge' },
    { kind: 'json', key: 'items', label: 'List items' },
  ],
}

export default calloutModule
