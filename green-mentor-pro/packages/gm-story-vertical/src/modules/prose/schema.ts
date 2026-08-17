import { z } from 'zod'

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
