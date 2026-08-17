/**
 * The universal spine — the 9-block skeleton present in every corpus issue,
 * in its fixed order. Templates compose their configs from these builders so
 * the house invariants (one pullquote, 4 audience chips, 3 footer columns,
 * band rhythm) are baked in rather than remembered.
 *
 * A GM section's foreground is ALWAYS regions-form (`{layout, regions}`) —
 * flat layer arrays would let the engine's built-in text card render over
 * the slide.
 */

export type GmSection = {
  id: string
  text: string
  background: Array<Record<string, unknown>>
  foreground: { layout: string; regions: Record<string, unknown[]> }
}

export function gmSection(
  id: string,
  anchor: string,
  tone: 'light' | 'tint' | 'pale' | 'off' | 'dark' | 'green' | 'page',
  layers: Array<Record<string, unknown>>
): GmSection {
  return {
    id,
    text: anchor,
    background: [{ type: 'gm:surface', tone }],
    foreground: { layout: 'free', regions: { default: layers } },
  }
}

export function frontmatter(input: {
  title: string
  subtitle: string
  byline?: string
  date?: string
}): string {
  return [
    '---',
    `title: ${input.title}`,
    `subtitle: ${input.subtitle}`,
    `byline: ${input.byline ?? 'GreenMentor'}`,
    `date: ${input.date ?? ''}`,
    'format: deck',
    'vertical: greenmentor',
    'status: draft',
    '---',
  ].join('\n')
}

export const GM_STORY_DEFAULTS = {
  scroll: { mode: 'snap' },
} as const
