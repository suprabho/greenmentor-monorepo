import { z } from 'zod'

/**
 * `gm:scoreDonut` — one score as a ring, for the "X out of 100" figure that anchors
 * an index or readiness band (an EPI score, a BRSR readiness rating).
 *
 * An SVG ring rather than a chart: it must be legible at a glance, needs no axes,
 * and renders identically in the capture path without ECharts booting. Reach for the
 * core `chart` module the moment there is more than one number to show.
 */
export const scoreDonutSchema = z.object({
  type: z.literal('gm:scoreDonut'),
  eyebrow: z.string().optional(),
  title: z.string().optional().describe('Supports *emphasis* spans.'),
  value: z.number().describe('The score, rendered inside the ring.'),
  max: z.number().default(100).describe('The scale ceiling. The ring fills value / max.'),
  label: z.string().optional().describe("Mono caption beside the ring, e.g. 'EPI Score'."),
  note: z.string().optional().describe('One sentence giving the figure meaning.'),
  onDark: z.boolean().default(false),
})

export type ScoreDonutConfig = z.infer<typeof scoreDonutSchema>
