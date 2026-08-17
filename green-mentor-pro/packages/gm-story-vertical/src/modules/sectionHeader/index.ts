import { z } from 'zod'
import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'

/**
 * `gm:sectionHeader` — a standalone act-divider slide: eyebrow rule + big
 * Syne title, optionally backed by a ghost numeral (act number).
 */
export const sectionHeaderSchema = z.object({
  type: z.literal('gm:sectionHeader'),
  eyebrow: z.string().optional(),
  title: z.string().min(1).describe('Supports *emphasis* spans.'),
  ghostNumeral: z.string().optional().describe("Oversized ghosted figure behind, e.g. '02'."),
  onDark: z.boolean().default(false),
})

export type SectionHeaderConfig = z.infer<typeof sectionHeaderSchema>

const sectionHeaderModule: VizModule<SectionHeaderConfig> = {
  type: 'gm:sectionHeader',
  label: 'GM section header',
  slots: ['foreground'],
  schema: sectionHeaderSchema,
  parseConfig: (raw, ctx) => parseWithSchema(sectionHeaderSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [
    { kind: 'text', key: 'eyebrow', label: 'Eyebrow' },
    { kind: 'text', key: 'title', label: 'Title', required: true },
    { kind: 'text', key: 'ghostNumeral', label: 'Ghost numeral' },
  ],
}

export default sectionHeaderModule
