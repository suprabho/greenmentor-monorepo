import { z } from 'zod'
import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'

/**
 * `gm:prose` — the workhorse section: eyebrow + Syne title + body paragraphs
 * in the newsletter measure (7–23 per corpus issue). When `paragraphs` is
 * omitted the module renders the unit's resolved markdown paragraphs from the
 * story body instead (foreground content contract).
 */
export const proseSchema = z.object({
  type: z.literal('gm:prose'),
  eyebrow: z.string().optional().describe('Mono uppercase kicker above the title.'),
  title: z.string().optional().describe('Section title. Supports *emphasis* spans.'),
  paragraphs: z
    .array(z.string())
    .optional()
    .describe('Literal body paragraphs. Omit to render the section markdown.'),
  onDark: z.boolean().default(false),
})

export type ProseConfig = z.infer<typeof proseSchema>

const proseModule: VizModule<ProseConfig> = {
  type: 'gm:prose',
  label: 'GM prose section',
  slots: ['foreground'],
  schema: proseSchema,
  parseConfig: (raw, ctx) => parseWithSchema(proseSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [
    { kind: 'text', key: 'eyebrow', label: 'Eyebrow' },
    { kind: 'text', key: 'title', label: 'Title' },
  ],
}

export default proseModule
