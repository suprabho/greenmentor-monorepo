import { z } from 'zod'

/**
 * `gm:footer` — the dark closing band: logo line + tagline, exactly three
 * mono-labelled columns (Publication / Next Issue / Referenced themes in the
 * corpus), then a copyright row. Optional closing note (the photo-essay
 * family's warm sign-off) and source list are absorbed here.
 */
export const footerSchema = z.object({
  type: z.literal('gm:footer'),
  logo: z.string().default('GreenMentor'),
  tagline: z.string().optional(),
  columns: z
    .array(
      z.object({
        label: z.string().min(1),
        body: z.string().min(1),
      })
    )
    .length(3)
    .describe('Exactly 3 columns of {label, body}.'),
  closingNote: z
    .object({
      emoji: z.string().optional(),
      text: z.string(),
      signature: z.string().optional(),
    })
    .optional()
    .describe('Optional warm sign-off above the columns (photo-essay family).'),
  copyright: z.string().optional().describe("e.g. '© 2026 GreenMentor. All rights reserved.'"),
})

export type FooterConfig = z.infer<typeof footerSchema>
