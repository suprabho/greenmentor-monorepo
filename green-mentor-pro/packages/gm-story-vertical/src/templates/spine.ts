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

/** YAML-quote a scalar. JSON string escaping is valid YAML double-quoting,
 *  so titles/subtitles with colons, quotes or dashes can't corrupt the
 *  frontmatter block (an unquoted `a: b` value is a YAML parse error). */
const yamlScalar = (s: string): string => JSON.stringify(s)

export function frontmatter(input: {
  title: string
  subtitle: string
  byline?: string
  date?: string
}): string {
  return [
    '---',
    `title: ${yamlScalar(input.title)}`,
    `subtitle: ${yamlScalar(input.subtitle)}`,
    `byline: ${yamlScalar(input.byline ?? 'GreenMentor')}`,
    `date: ${yamlScalar(input.date ?? '')}`,
    'format: deck',
    'vertical: greenmentor',
    'status: draft',
    '---',
  ].join('\n')
}

export const GM_STORY_DEFAULTS = {
  scroll: { mode: 'snap' },
} as const

export const GM_FOOTER_COLUMNS = [
  { label: 'Publication', body: 'What this briefing is and who it serves.' },
  { label: 'Next Issue', body: 'One-line tease of the next issue.' },
  { label: 'Referenced', body: 'Standards / sources referenced in this issue.' },
]

/**
 * The dark gm:footer band every corpus issue closes on. Shared by the
 * starter templates and by the compose pipeline's materialize step, which
 * falls back to this when an outline (LLM-generated or otherwise) omits it —
 * every issue must end on a closing section, not just the ones the
 * generation step remembered to ask for.
 */
export function closingSection(footer?: Record<string, unknown>): GmSection {
  return gmSection('closing', 'Closing', 'dark', [
    { type: 'gm:footer', logo: 'GreenMentor', columns: GM_FOOTER_COLUMNS, ...footer },
  ])
}
