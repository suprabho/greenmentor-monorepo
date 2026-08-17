/**
 * Deterministic GM cover completion.
 *
 * The vismay VISUAL prompt hard-codes the deck cover rule: cover/hero
 * sections author only `eyebrow` + `dek` as section fields and leave
 * `foreground` EMPTY — the pipeline then completes the cover with the core
 * editorial surface (hero-full-bleed layout, display heading, panel chrome).
 * That surface is vismay's design language, not GreenMentor's: a GM issue
 * opens on a gm:hero band. So, mirroring completeCoverBody's philosophy,
 * this maps the authored cover fields into a gm:hero layer instead —
 * deterministically, no model call:
 *
 *   heading → title, dek → subtitle, eyebrow ("Topic · Date · What this is")
 *   → up to 4 tags split on '·'.
 *
 * The core cover fields (layout/panel/heading/eyebrow/dek) are dropped —
 * gm:hero replaces the surface they configured. A cover that already carries
 * foreground layers passes through untouched.
 */

interface CoverInput {
  heading: string
  issueDate?: string
}

function hasForegroundLayers(fg: unknown): boolean {
  if (!fg || typeof fg !== 'object') return false
  if (Array.isArray(fg)) return fg.length > 0
  if ('regions' in (fg as object)) {
    const regions = (fg as { regions: Record<string, unknown> }).regions ?? {}
    return Object.values(regions).some((r) =>
      Array.isArray(r)
        ? r.length > 0
        : !!r && typeof r === 'object' && ('layers' in r ? Array.isArray((r as { layers: unknown }).layers) && ((r as { layers: unknown[] }).layers.length > 0) : true)
    )
  }
  return typeof (fg as { type?: unknown }).type === 'string'
}

export function completeGmCoverBody(
  body: Record<string, unknown>,
  input: CoverInput
): Record<string, unknown> {
  if (hasForegroundLayers(body.foreground)) return body

  const eyebrow = typeof body.eyebrow === 'string' ? body.eyebrow : ''
  const dek = typeof body.dek === 'string' ? body.dek : undefined
  const tags = eyebrow
    .split('·')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 4)

  const hero: Record<string, unknown> = {
    type: 'gm:hero',
    title: input.heading,
    ...(dek ? { subtitle: dek } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(input.issueDate ? { issueDate: input.issueDate } : {}),
  }

  const out = { ...body }
  delete out.layout
  delete out.panel
  delete out.heading
  delete out.eyebrow
  delete out.dek
  out.foreground = { layout: 'free', regions: { default: [hero] } }
  return out
}
