import { z } from 'zod'
import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'

/**
 * `gm:explainerGrid` — hairline-boxed numbered cards (30/36 issues; the
 * most-used content block after prose). Exactly one card may be inverted to
 * black via `activeIndex` — the corpus's invert-one-cell accent. In autoplay,
 * `activeStep` sweeps the inverted cell across the cards.
 */
export const explainerGridSchema = z.object({
  type: z.literal('gm:explainerGrid'),
  eyebrow: z.string().optional(),
  title: z.string().optional().describe('Supports *emphasis* spans.'),
  columns: z.number().int().min(2).max(4).optional().describe('Defaults to card count (max 4).'),
  cards: z
    .array(
      z.object({
        number: z.string().optional().describe("Big numeral, e.g. '1'. Defaults to position."),
        label: z.string().min(1).describe('Mono uppercase card label.'),
        description: z.string().min(1),
      })
    )
    .min(2)
    .max(6),
  activeIndex: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Which card renders inverted (black). Omit for none.'),
  onDark: z.boolean().default(false),
})

export type ExplainerGridConfig = z.infer<typeof explainerGridSchema>

const explainerGridModule: VizModule<ExplainerGridConfig> = {
  type: 'gm:explainerGrid',
  label: 'GM explainer grid',
  slots: ['foreground'],
  schema: explainerGridSchema,
  parseConfig: (raw, ctx) => parseWithSchema(explainerGridSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [
    { kind: 'text', key: 'eyebrow', label: 'Eyebrow' },
    { kind: 'text', key: 'title', label: 'Title' },
    { kind: 'json', key: 'cards', label: 'Cards ({number, label, description})' },
    { kind: 'number', key: 'activeIndex', label: 'Inverted card index' },
  ],
}

export default explainerGridModule
