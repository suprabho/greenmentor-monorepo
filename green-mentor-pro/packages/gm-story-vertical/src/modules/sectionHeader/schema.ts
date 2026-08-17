import { z } from 'zod'

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
