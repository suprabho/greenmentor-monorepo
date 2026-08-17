import { z } from 'zod'

/**
 * `gm:statGrid` — big-number stat cards ("By the Numbers" / spotlight). The
 * corpus's only quantitative display, unified from four competing class
 * vocabularies (sector-*, spot-*, stat-*, spotlight-*). Values count up on
 * first activation in live scroll; capture/print render final values.
 */
export const statGridSchema = z.object({
  type: z.literal('gm:statGrid'),
  eyebrow: z.string().optional(),
  title: z.string().optional().describe('Supports *emphasis* spans.'),
  columns: z.number().int().min(1).max(4).optional().describe('Defaults to card count (max 4).'),
  items: z
    .array(
      z.object({
        value: z.string().min(1).describe("Display figure, e.g. '176', '22.46', '30%'. Counts up when numeric."),
        unit: z.string().optional().describe("Suffix rendered small, e.g. '/177', 'MtCO₂e'."),
        label: z.string().min(1).describe('What the figure is.'),
        note: z.string().optional().describe('One-line footnote under the figure.'),
        icon: z.string().optional().describe('Optional emoji icon.'),
        sourceTag: z.string().optional().describe('Source chip, e.g. EPI 2026.'),
      })
    )
    .min(1)
    .max(8),
  onDark: z.boolean().default(false),
})

export type StatGridConfig = z.infer<typeof statGridSchema>
