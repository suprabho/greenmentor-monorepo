import { z } from 'zod'

/**
 * `gm:hero` — the opening slide. Reproduces the newsletter corpus's hero
 * family (CSS comments in the corpus literally name variants A/B/C) and folds
 * in the issue top bar:
 *
 *   - `split`     — black editorial panel left, green issue panel right with a
 *                   huge ghosted issue numeral bleeding off the corner (~32/34 issues)
 *   - `stacked`   — same parts stacked; full-width title, issue strip below
 *   - `editorial` — full-width editorial panel, no issue panel
 *   - `bold`      — solid green block, ghost numeral behind the title
 *
 * `title` supports `*emphasis*` spans, rendered as italic Instrument Serif in
 * the light green accent — the corpus's strongest typographic signature.
 */
export const heroSchema = z.object({
  type: z.literal('gm:hero'),
  variant: z.enum(['split', 'stacked', 'editorial', 'bold']).default('split'),
  brandLine: z.string().default('GreenMentor').describe('Publication name in the top strip.'),
  title: z
    .string()
    .min(1)
    .describe('Headline. Wrap the emphasized phrase in *asterisks* → italic serif accent.'),
  subtitle: z.string().optional().describe('One-sentence dek under the title.'),
  tags: z.array(z.string()).max(4).default([]).describe('Up to 4 topic chips.'),
  issueLabel: z.string().default('Issue').describe('Label above the issue number.'),
  issueNumber: z.string().optional().describe("Issue numeral, e.g. '38'. Drives the ghost figure."),
  issueDate: z.string().optional().describe("Human date line, e.g. 'August 2026'."),
})

export type HeroConfig = z.infer<typeof heroSchema>
