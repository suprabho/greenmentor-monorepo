import { z } from 'zod'

/**
 * `gm:standfirst` — the intro band: green-ruled off-white strip with a green
 * dot and ONE italic Instrument Serif standfirst paragraph (36/36 issues).
 */
export const standfirstSchema = z.object({
  type: z.literal('gm:standfirst'),
  text: z.string().min(1).describe('The single italic-serif standfirst paragraph.'),
  onDark: z.boolean().default(false),
})

export type StandfirstConfig = z.infer<typeof standfirstSchema>
