import { z } from 'zod'

/**
 * `gm:cta` — the newsletter's closing ask: a bordered card with a headline, one
 * line of body, and a single filled button (subscribe, download the report,
 * book a call). Distinct from `gm:footer`, which is masthead furniture; this is
 * the one place in a story where the reader is asked to do something.
 */
export const ctaSchema = z.object({
  type: z.literal('gm:cta'),
  eyebrow: z.string().optional(),
  title: z.string().min(1).describe('Supports *emphasis* spans.'),
  body: z.string().optional().describe('One or two sentences of context for the ask.'),
  actionLabel: z.string().min(1).describe("Button text, e.g. 'Read the full brief'."),
  actionHref: z.string().min(1).describe('Absolute URL the button points at.'),
  note: z.string().optional().describe('Small print under the button (cadence, price, no-spam line).'),
  onDark: z.boolean().default(false),
})

export type CtaConfig = z.infer<typeof ctaSchema>
