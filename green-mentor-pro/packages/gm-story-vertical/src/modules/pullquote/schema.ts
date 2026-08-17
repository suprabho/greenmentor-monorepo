import { z } from 'zod'

/**
 * `gm:pullquote` — the green full-bleed quote band: giant ghosted quote glyph,
 * italic Instrument Serif quote, mono citation. Exactly ONE per issue in all
 * 34 corpus issues — `lintGmStory` enforces the same discipline.
 * Schema deliberately mirrors the core `quote` module (text/attribution) so
 * AI generation can fall back between them.
 */
export const pullquoteSchema = z.object({
  type: z.literal('gm:pullquote'),
  text: z.string().min(1).describe('The quote, without surrounding quote marks.'),
  attribution: z.string().optional().describe('Mono citation line, e.g. a name and role.'),
})

export type PullquoteConfig = z.infer<typeof pullquoteSchema>
