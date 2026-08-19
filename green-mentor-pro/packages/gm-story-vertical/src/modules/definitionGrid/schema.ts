import { z } from 'zod'

/**
 * `gm:definitionGrid` — term/definition pairs, for the band where a story has to
 * establish shared vocabulary before it can argue (Scope 3, BRSR Core, CBAM).
 *
 * Distinct from `gm:explainerGrid`, which is an ORDERED set with one cell accented
 * as the reader's entry point. These are unordered and carry equal weight, so the
 * grid uses hairline rules rather than the hard-bordered cells.
 */
export const definitionGridSchema = z.object({
  type: z.literal('gm:definitionGrid'),
  eyebrow: z.string().optional(),
  title: z.string().optional().describe('Supports *emphasis* spans.'),
  columns: z.number().int().min(1).max(2).optional().describe('Defaults to 2 above 3 items, else 1.'),
  items: z
    .array(
      z.object({
        term: z.string().min(1).describe('The term being defined, e.g. "Scope 3".'),
        definition: z
          .string()
          .min(1)
          .describe('One plain-language sentence that does not re-use the term itself.'),
      })
    )
    .min(2)
    .max(6),
  onDark: z.boolean().default(false),
})

export type DefinitionGridConfig = z.infer<typeof definitionGridSchema>
