import { z } from 'zod'

/**
 * `gm:audienceStrip` — the pale-green "Resonates with" chips band. Every
 * corpus issue has exactly 4 chips, so the schema enforces it.
 */
export const audienceStripSchema = z.object({
  type: z.literal('gm:audienceStrip'),
  label: z.string().default('Resonates with'),
  chips: z.array(z.string().min(1)).length(4).describe('Exactly 4 audience chips.'),
})

export type AudienceStripConfig = z.infer<typeof audienceStripSchema>
