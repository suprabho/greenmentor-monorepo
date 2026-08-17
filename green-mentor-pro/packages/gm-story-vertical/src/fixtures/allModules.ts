/**
 * Fixture story: the module gallery ("kitchen sink"). One synthetic issue that
 * exercises every gm:* module — including the ones issue38 doesn't reach —
 * and the variants issue38 doesn't use:
 *
 *   - gm:sectionHeader (act divider, ghost numeral)     — not in issue38
 *   - gm:hero `bold` variant                            — issue38 uses `split`
 *   - gm:steps `chain` variant                          — issue38 uses `list`
 *   - gm:prose with config `paragraphs`                 — issue38 is markdown-fed only
 *   - gm:callout with `paragraphs` AND `items`          — issue38 uses items only
 *   - gm:footer with `closingNote`                      — issue38 omits it
 *   - gm:surface `page` tone                            — issue38 never uses it
 *
 * Rendered by the platform /stories/demo-all route; pack.test.ts asserts every
 * layer here parses through the module schemas and that coverage stays total.
 */

export const ALL_MODULES_SLUG = 'fixture-all-modules'

export const allModulesMarkdown = `---
title: Every Module, One Story
subtitle: The gm story vertical's full module gallery — every band the compose pipeline can emit, rendered end to end.
byline: GreenMentor
date: 2026-08-17
format: deck
vertical: greenmentor
status: published
---

## Opening

## Standfirst

## Act One

## Markdown Prose

This section's body lives in the story markdown, not the config — the gm:prose
module renders the unit's resolved paragraphs when \`paragraphs\` is omitted.
That is the compose pipeline's CONTENT-pass contract.

A second paragraph proves multi-paragraph flow: short sentences, newsletter
measure, no surprises.

## By the Numbers

## Config Prose

## Pressure Grid

## Process Chain

## Worked Example

## Pull Quote

## Takeaways

## Audience

## Closing
`

export const allModulesConfig = {
  defaults: {
    scroll: { mode: 'snap' },
  },
  sections: [
    {
      id: 'opening',
      text: 'Opening',
      background: [{ type: 'gm:surface', tone: 'dark' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:hero',
          variant: 'bold',
          brandLine: 'GreenMentor · Module Gallery',
          title: 'Every Module, *One Story*',
          subtitle:
            'A synthetic issue that walks the full gm story vertical — all thirteen modules, both prose modes, every band tone.',
          tags: ['Fixture', 'All Modules', 'Render Test'],
          issueLabel: 'Issue',
          issueNumber: '00',
          issueDate: 'August 17, 2026',
        },
      ] } },
    },
    {
      id: 'standfirst',
      text: 'Standfirst',
      background: [{ type: 'gm:surface', tone: 'off' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:standfirst',
          text: 'If the compose pipeline can emit it, this story renders it — one section per module, in the corpus band rhythm, so a single scroll verifies the whole rendering surface.',
        },
      ] } },
    },
    {
      id: 'act-one',
      text: 'Act One',
      background: [{ type: 'gm:surface', tone: 'page' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:sectionHeader',
          eyebrow: 'Act 01',
          title: 'The Content *Modules*',
          ghostNumeral: '01',
        },
      ] } },
    },
    {
      id: 'markdown-prose',
      text: 'Markdown Prose',
      background: [{ type: 'gm:surface', tone: 'light' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:prose',
          eyebrow: 'Prose · Markdown-Fed',
          title: 'Body From the *Story Markdown*',
        },
      ] } },
    },
    {
      id: 'by-the-numbers',
      text: 'By the Numbers',
      background: [{ type: 'gm:surface', tone: 'tint' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:statGrid',
          eyebrow: 'By the Numbers',
          title: 'Four Stats, *Four Columns*',
          columns: 4,
          items: [
            { value: '13', label: 'gm modules', note: 'Registered by the vertical loader.', sourceTag: 'Registry' },
            { value: '7', label: 'Band tones', note: 'light · tint · pale · off · dark · green · page.', sourceTag: 'Tokens' },
            { value: '30%', label: 'Emphasis spans', note: 'Italic serif accents inside titles.', sourceTag: 'House style' },
            { value: '22.46', unit: '/100', label: 'Count-up value', note: 'Decimal values animate on first activation.', sourceTag: 'Fixture' },
          ],
        },
      ] } },
    },
    {
      id: 'config-prose',
      text: 'Config Prose',
      background: [{ type: 'gm:surface', tone: 'light' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:prose',
          eyebrow: 'Prose · Config-Fed',
          title: 'Body From *Literal Paragraphs*',
          paragraphs: [
            'This prose section carries its paragraphs in the config, overriding the markdown flow — the other prose mode the schema allows.',
            'Both modes must render identically in measure and rhythm; only the source of the words differs.',
          ],
        },
      ] } },
    },
    {
      id: 'pressure-grid',
      text: 'Pressure Grid',
      background: [{ type: 'gm:surface', tone: 'tint' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:explainerGrid',
          eyebrow: 'Framework',
          title: 'Four Cards, *One Inverted*',
          columns: 4,
          activeIndex: 2,
          cards: [
            { number: 'A', label: 'Regulatory', description: 'Disclosure rules move from voluntary to mandated.' },
            { number: 'B', label: 'Financial', description: 'Lenders price climate exposure into capital costs.' },
            { number: 'C', label: 'Buyer', description: 'Procurement questionnaires become gating criteria.' },
            { number: 'D', label: 'Physical', description: 'Heat, water and flood risk hit operations directly.' },
          ],
        },
      ] } },
    },
    {
      id: 'process-chain',
      text: 'Process Chain',
      background: [{ type: 'gm:surface', tone: 'light' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:steps',
          eyebrow: 'The Playbook',
          title: 'The *Chain* Variant',
          variant: 'chain',
          steps: [
            { title: 'Measure', body: 'Baseline energy, emissions and waste.' },
            { title: 'Prioritise', body: 'Run a materiality screen by sector.' },
            { title: 'Commit', body: 'Set SMART targets with owners.' },
            { title: 'Report', body: 'Disclose against BRSR and GRI.' },
          ],
        },
      ] } },
    },
    {
      id: 'worked-example',
      text: 'Worked Example',
      background: [{ type: 'gm:surface', tone: 'tint' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:callout',
          title: 'Paragraphs and Items Together',
          badge: 'Example',
          paragraphs: [
            'A callout may open with running prose before its compact list — both body modes render in one box.',
          ],
          items: [
            '✕ Vague: "Improve supplier sustainability."',
            '✓ SMART: "Audit the top 20 suppliers against the code of conduct by Q2 FY27."',
          ],
        },
      ] } },
    },
    {
      id: 'pull-quote',
      text: 'Pull Quote',
      background: [{ type: 'gm:surface', tone: 'green' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:pullquote',
          text: 'A rendering pipeline is only as trustworthy as the ugliest story it has already survived.',
        },
      ] } },
    },
    {
      id: 'takeaways',
      text: 'Takeaways',
      background: [{ type: 'gm:surface', tone: 'dark' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:takeaways',
          eyebrow: 'Practitioner Summary',
          items: [
            { lead: 'Thirteen modules, one scroll.', body: 'Every layer type the pack can emit appears exactly once here.' },
            { lead: 'Minimum items still render.', body: 'This band uses the schema floor of three takeaways, no title.' },
            { lead: 'Fixtures beat screenshots.', body: 'The pack test parses every layer on every commit.' },
          ],
        },
      ] } },
    },
    {
      id: 'audience',
      text: 'Audience',
      background: [{ type: 'gm:surface', tone: 'pale' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:audienceStrip',
          label: 'Resonates with',
          chips: ['Engine Maintainers', 'Story Editors', 'Compose Pipeline', 'QA Screenshots'],
        },
      ] } },
    },
    {
      id: 'closing',
      text: 'Closing',
      background: [{ type: 'gm:surface', tone: 'dark' }],
      foreground: { layout: 'free', regions: { default: [
        {
          type: 'gm:footer',
          logo: 'GreenMentor',
          tagline: 'Module Gallery · Fixture Edition',
          closingNote: {
            emoji: '🌱',
            text: 'If you scrolled this far, every module rendered. Thanks for testing with us.',
            signature: '— The GreenMentor desk',
          },
          columns: [
            { label: 'Publication', body: 'A synthetic issue used to verify the full gm story vertical end to end.' },
            { label: 'Next Issue', body: 'A real one, composed by the pipeline this fixture protects.' },
            { label: 'Referenced', body: 'BRSR · GRI · IFRS S1/S2 · GHG Protocol' },
          ],
          copyright: '© 2026 GreenMentor · Fixture — not for publication',
        },
      ] } },
    },
  ],
}

export const allModulesConfigJson = JSON.stringify(allModulesConfig, null, 2)
