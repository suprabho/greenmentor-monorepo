import type { DomainPack, PackLayerType } from '@vismay/story-pipeline'
import { heroSchema } from '../modules/hero/schema'
import { standfirstSchema } from '../modules/standfirst/schema'
import { sectionHeaderSchema } from '../modules/sectionHeader/schema'
import { proseSchema } from '../modules/prose/schema'
import { pullquoteSchema } from '../modules/pullquote/schema'
import { takeawaysSchema } from '../modules/takeaways/schema'
import { audienceStripSchema } from '../modules/audienceStrip/schema'
import { footerSchema } from '../modules/footer/schema'
import { statGridSchema } from '../modules/statGrid/schema'
import { explainerGridSchema } from '../modules/explainerGrid/schema'
import { stepsSchema } from '../modules/steps/schema'
import { calloutSchema } from '../modules/callout/schema'
import { comparisonTableSchema } from '../modules/comparisonTable/schema'
import { definitionGridSchema } from '../modules/definitionGrid/schema'
import { scoreDonutSchema } from '../modules/scoreDonut/schema'
import { ctaSchema } from '../modules/cta/schema'

/**
 * The GreenMentor editorial desk for @vismay/story-pipeline. Passed by value
 * as `opts.pack` to every pipeline call — never registered upstream.
 *
 * The gm module zod schemas are used DIRECTLY as the generation contract
 * (they're provider-safe by construction: literal `type` discriminators, no
 * z.record, no tuples), so a generated layer is valid by the same parseConfig
 * the renderer runs — no mirror to drift. Schemas are imported from each
 * module's zod-only `schema.ts` leaf so this pack (and pack.test.ts, which
 * asserts schema↔fixture agreement) never load the viz-engine runtime.
 *
 * All gm layers render in the `default` region of the `free` layout — the
 * modules are self-framing band renderers (see Band.tsx).
 */

const GM_REGIONS = ['default'] as const

const layer = (
  schema: PackLayerType['schema'],
  type: string,
  label: string,
  promptDoc: string
): PackLayerType => ({ type, label, schema, promptDoc, regions: GM_REGIONS })

export const GREENMENTOR_PACK: DomainPack = {
  id: 'greenmentor',
  name: 'GreenMentor',
  persona:
    'You are the GreenMentor editorial desk: plain, credible, India-grounded ESG analysis for practitioners — sustainability leads, CFOs, operations heads and founders who need to act on regulation (BRSR, EPR, CBAM), buyer pressure and climate risk, not admire the problem. ',
  angleGuidance:
    'Prefer angles that turn a news event or dataset into a decision the reader must make. ' +
    'The strongest GreenMentor angles name the mechanism (who is forcing whom, through what channel — a buyer requirement, a SEBI rule, a tariff) and what breaks if the reader waits.',
  outlineGuidance:
    'A GreenMentor issue follows a fixed spine, in order: one gm:hero cover; one gm:standfirst ' +
    '(a single italic framing sentence); 3–6 argument sections alternating prose with exactly one ' +
    'quantitative moment (gm:statGrid) and at most one framework moment (gm:explainerGrid or ' +
    'gm:steps); at most one comparison moment (gm:comparisonTable, gm:definitionGrid or ' +
    'gm:scoreDonut) where a section turns on a side-by-side, a vocabulary or a single index ' +
    'score; EXACTLY ONE gm:pullquote section; one gm:takeaways section ' +
    '(3–5 numbered items, practitioner phrasing); one gm:audienceStrip (exactly 4 chips naming ' +
    'roles); an optional gm:cta when the issue has a concrete ask; one gm:footer closing. ' +
    'Never place two dark sections adjacently. Section headings are ' +
    'short Syne-style declaratives ("Where India Stands"), not questions.',
  contentGuidance:
    'Voice: plain, credible, India/ESG-grounded. Short paragraphs (2–3 sentences). Numbers carry ' +
    'the argument; adjectives do not. Compliance framing: "the floor, not the ceiling". Every ' +
    'section should leave a practitioner knowing what to DO, not just what happened.',
  visualGuidance:
    'Every section body is exactly one gm:* layer in the default region. Emphasis spans use ' +
    '*asterisks* inside titles (rendered as italic serif in the accent green). Stat values are ' +
    'bare figures ("176", "22.46", "30%") with units split into the unit field. Omit onDark — ' +
    'the band system sets it.',
  bylineExample: 'GreenMentor',
  formats: ['deck'],
  extraLayerTypes: [
    layer(
      heroSchema,
      'gm:hero',
      'GreenMentor issue cover (title, tags, issue panel)',
      'The opening slide, exactly once, always first. title supports *emphasis* spans (the phrase to set in italic serif accent). 3–4 short tags. issueNumber/issueDate when known; omit brandLine to accept the default.'
    ),
    layer(
      standfirstSchema,
      'gm:standfirst',
      'Italic-serif standfirst band',
      'Exactly once, immediately after the hero: ONE italic sentence (25–45 words) framing what happened and why a practitioner should care. No heading, no numbers.'
    ),
    layer(
      sectionHeaderSchema,
      'gm:sectionHeader',
      'Act-divider slide (eyebrow + big title)',
      'A breather slide introducing a new act in a long issue. Use sparingly (0–2 per issue). ghostNumeral is the act number ("02").'
    ),
    layer(
      proseSchema,
      'gm:prose',
      'Prose section (eyebrow + title; body from markdown)',
      'The workhorse. Set eyebrow (mono kicker) and title (may carry ONE *emphasis* span). OMIT the paragraphs field — body prose lives in the markdown section and flows in automatically.'
    ),
    layer(
      statGridSchema,
      'gm:statGrid',
      'Big-number stat cards ("By the Numbers")',
      "The issue's quantitative moment: 2–4 stats with value (bare figure that can count up), unit (suffix like /177 or MtCO₂e), label (mono uppercase), note (one grounded sentence), sourceTag (dataset name). Use once per issue where the numbers ARE the argument."
    ),
    layer(
      explainerGridSchema,
      'gm:explainerGrid',
      'Numbered concept cards (invert-one accent)',
      'A 2–4 card framework (pressures, pillars, phases). activeIndex inverts ONE card to black — point it at the card the section argues matters most.'
    ),
    layer(
      stepsSchema,
      'gm:steps',
      'Numbered step sequence (playbook)',
      "A how-to sequence of 3–8 steps, each title + one-sentence body. variant 'list' for playbooks; 'chain' only for short 3–4 node process flows."
    ),
    layer(
      calloutSchema,
      'gm:callout',
      'Callout box (black header + badge)',
      'A boxed worked example, definition or warning. badge is a 1-word uppercase chip ("Example", "Rule"). Use items for ✕/✓ contrasts or short lists.'
    ),
    layer(
      comparisonTableSchema,
      'gm:comparisonTable',
      'Comparison table (2–3 columns)',
      'For sections that turn on a side-by-side: standard vs standard, before vs after, India vs peer. columns is the header row (2–3 short labels); each row is an array of the SAME length, first cell being the row label. Keep cells to a phrase. highlightColumn tints the column the section argues for (0-indexed, counting the label column).'
    ),
    layer(
      definitionGridSchema,
      'gm:definitionGrid',
      'Term/definition grid (glossary band)',
      'For unfamiliar vocabulary a practitioner needs before the argument lands (Scope 3, CBAM, transition plan). 2–6 term/definition pairs, each definition ONE sentence. Use once at most, early. Prefer gm:explainerGrid when the items are a framework rather than a glossary.'
    ),
    layer(
      scoreDonutSchema,
      'gm:scoreDonut',
      'Single score ring (index / readiness figure)',
      'ONE score as a ring — an EPI rank, a readiness rating, a percentage of compliance. value plus max (default 100), label as the mono caption, note as one sentence giving the figure meaning. Use gm:statGrid instead the moment there is more than one number.'
    ),
    layer(
      pullquoteSchema,
      'gm:pullquote',
      'Full-bleed green pull quote',
      'EXACTLY ONE per issue. The single load-bearing quotation (a real quote from sources when available, else a sharpened editorial line). attribution is a mono citation.'
    ),
    layer(
      takeawaysSchema,
      'gm:takeaways',
      'Numbered practitioner summary (black band)',
      'EXACTLY ONE, near the end: 3–5 items, each lead (bolded imperative claim) + body (one supporting sentence). This is what the reader takes back to their desk.'
    ),
    layer(
      audienceStripSchema,
      'gm:audienceStrip',
      '"Resonates with" role chips',
      'EXACTLY ONE, after the takeaways: exactly 4 chips naming reader roles ("ESG & Sustainability Leads", "CFOs & Risk Officers", …).'
    ),
    layer(
      ctaSchema,
      'gm:cta',
      'Call to action card (single button)',
      'At most one, between the audience strip and the footer, and only when the issue has a real ask. title carries the ask, actionLabel/actionHref the button, note the small print. Omit entirely rather than inventing a link.'
    ),
    layer(
      footerSchema,
      'gm:footer',
      'Issue footer (3 columns + copyright)',
      'EXACTLY ONE, always last: exactly 3 columns — Publication (what this briefing is), Next Issue (one-line tease), Referenced (standards/sources like "BRSR · GRI · IFRS S1/S2").'
    ),
  ],
}
