import { z } from 'zod'

/**
 * `gm:takeaways` — the black full-bleed numbered summary band (36/36 issues:
 * 5 items ×23, 4 items ×11, 3 items ×2 — hence .min(3).max(5)).
 */
export const takeawaysSchema = z.object({
  type: z.literal('gm:takeaways'),
  eyebrow: z.string().default('Practitioner Summary'),
  title: z.string().optional().describe('Optional heading. Supports *emphasis*.'),
  items: z
    .array(
      z.object({
        lead: z.string().min(1).describe('Bolded takeaway lead-in.'),
        body: z.string().optional().describe('One-sentence elaboration.'),
      })
    )
    .min(3)
    .max(5),
})

export type TakeawaysConfig = z.infer<typeof takeawaysSchema>
