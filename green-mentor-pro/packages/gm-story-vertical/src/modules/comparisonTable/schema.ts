import { z } from 'zod'

/**
 * `gm:comparisonTable` — a narrow before/after, us/them, rule/exception table.
 *
 * Deliberately small: 2–3 columns, up to 5 rows. Rows reveal one at a time as the
 * band settles, which is what makes a table worth reading in a scrollytelling
 * context rather than as a static block. Anything wider or longer belongs in a
 * chart, where the shape carries the comparison instead of the reader's eye.
 */
export const comparisonTableSchema = z.object({
  type: z.literal('gm:comparisonTable'),
  eyebrow: z.string().optional(),
  title: z.string().optional().describe('Supports *emphasis* spans.'),
  columns: z
    .array(z.string().min(1))
    .min(2)
    .max(3)
    .describe('Headings. The first names the row dimension; the rest carry the values.'),
  rows: z
    .array(z.array(z.string()).min(2).max(3))
    .min(1)
    .max(5)
    .describe('Each row the same length as `columns`.'),
  highlightColumn: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("0-based index of the column that is the 'answer' (the after state, the compliant option)."),
  onDark: z.boolean().default(false),
})

export type ComparisonTableConfig = z.infer<typeof comparisonTableSchema>
