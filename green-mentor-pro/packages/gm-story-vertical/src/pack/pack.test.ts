/**
 * Pack ↔ renderer agreement tests. Run with `pnpm test` (tsx --test).
 *
 * The gm module zod schemas are shared by construction between the generation
 * contract (GREENMENTOR_PACK) and the renderer's parseConfig (which delegates
 * to the same schema via parseWithSchema). What CAN drift is everything
 * around that identity: fixture configs vs schemas, fixture markdown vs
 * config anchors, pack coverage vs the module set, the lint rules, and the
 * band-rhythm stamping. These tests pin all of it, importing only zod-safe
 * leaf files (module schema.ts, fixtures, lib) — never the viz-engine
 * runtime.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { z } from 'zod'

import { GREENMENTOR_PACK } from './index'
import { surfaceSchema } from '../modules/surface/schema'
import {
  allModulesConfig,
  allModulesMarkdown,
} from '../fixtures/allModules'
import { issue38Config, issue38Markdown } from '../fixtures/issue38'
import { lintGmStory, isGmForegroundType } from '../lib/lintGmStory'
import { applyGmBandRhythm } from '../lib/applyGmBandRhythm'
import { completeGmCoverBody } from '../lib/completeGmCover'

/** Every gm module the VISUAL pass may emit (gm:surface is background-only —
 *  the band system stamps it programmatically, so it is NOT a pack layer). */
const PACK_LAYER_TYPES = [
  'gm:hero',
  'gm:standfirst',
  'gm:sectionHeader',
  'gm:prose',
  'gm:statGrid',
  'gm:explainerGrid',
  'gm:steps',
  'gm:callout',
  'gm:pullquote',
  'gm:takeaways',
  'gm:audienceStrip',
  'gm:footer',
] as const

type FixtureSection = {
  id: string
  text?: string
  background?: Array<{ type: string; [k: string]: unknown }>
  foreground?: { layout: string; regions: { default: Array<{ type: string; [k: string]: unknown }> } }
}

type FixtureConfig = { sections: FixtureSection[] }

const packSchemaByType = new Map<string, z.ZodTypeAny>(
  GREENMENTOR_PACK.extraLayerTypes.map((t) => [t.type, t.schema as z.ZodTypeAny])
)

function foregroundLayersOf(config: FixtureConfig): Array<{ section: string; layer: { type: string } }> {
  return config.sections.flatMap((s) =>
    (s.foreground?.regions.default ?? []).map((layer) => ({ section: s.id, layer }))
  )
}

test('pack layer types cover exactly the emittable gm modules', () => {
  assert.deepEqual(
    [...packSchemaByType.keys()].sort(),
    [...PACK_LAYER_TYPES].sort(),
    'GREENMENTOR_PACK.extraLayerTypes drifted from the module set'
  )
})

for (const [name, config] of [
  ['allModules', allModulesConfig as FixtureConfig],
  ['issue38', issue38Config as FixtureConfig],
] as const) {
  test(`${name}: every foreground layer parses through its pack/module schema`, () => {
    for (const { section, layer } of foregroundLayersOf(config)) {
      const schema = packSchemaByType.get(layer.type)
      assert.ok(schema, `${name}/${section}: no pack schema for layer '${layer.type}'`)
      const result = schema.safeParse(layer)
      assert.ok(
        result.success,
        `${name}/${section}: '${layer.type}' fails its schema — ${
          result.success ? '' : result.error.issues[0]?.message
        }`
      )
    }
  })

  test(`${name}: every background gm:surface parses through the surface schema`, () => {
    for (const s of config.sections) {
      const surfaces = (s.background ?? []).filter((l) => l.type === 'gm:surface')
      assert.equal(surfaces.length, 1, `${name}/${s.id}: expected exactly one gm:surface`)
      const result = surfaceSchema.safeParse(surfaces[0])
      assert.ok(
        result.success,
        `${name}/${s.id}: gm:surface fails its schema — ${
          result.success ? '' : result.error.issues[0]?.message
        }`
      )
    }
  })

  test(`${name}: lint-clean`, () => {
    const issues = lintGmStory(config as never)
    assert.deepEqual(
      issues,
      [],
      `${name}: expected no lint issues, got: ${issues.map((i) => `${i.rule}#${i.sectionIndex}`).join(', ')}`
    )
  })

  test(`${name}: band rhythm is idempotent on the fixture`, () => {
    assert.deepEqual(applyGmBandRhythm(structuredClone(config)), config)
  })
}

for (const [name, markdown, config] of [
  ['allModules', allModulesMarkdown, allModulesConfig as FixtureConfig],
  ['issue38', issue38Markdown, issue38Config as FixtureConfig],
] as const) {
  test(`${name}: every config section anchors to a markdown heading`, () => {
    const headings = new Set(
      markdown
        .split('\n')
        .filter((l) => /^##?\s+/.test(l))
        .map((l) => l.replace(/^##?\s+/, '').trim())
    )
    for (const s of config.sections) {
      assert.ok(
        s.text && headings.has(s.text),
        `${name}/${s.id}: config text '${s.text}' has no matching markdown heading`
      )
    }
  })
}

test('allModules fixture exercises every pack layer type', () => {
  const used = new Set(foregroundLayersOf(allModulesConfig as FixtureConfig).map((f) => f.layer.type))
  for (const type of PACK_LAYER_TYPES) {
    assert.ok(used.has(type), `allModules fixture is missing a '${type}' section`)
  }
})

test('isGmForegroundType admits gm modules and chart, rejects other core types', () => {
  assert.ok(isGmForegroundType('gm:prose'))
  assert.ok(isGmForegroundType('chart'))
  for (const core of ['text', 'bigStat', 'quote', 'keyValue', 'table', 'image']) {
    assert.equal(isGmForegroundType(core), false, `'${core}' should be flagged`)
  }
})

test('lint flags off-vertical foreground layers but not charts', () => {
  const config = {
    sections: [
      {
        id: 'x',
        background: [{ type: 'gm:surface', tone: 'light' }],
        foreground: { layout: 'free', regions: { default: [{ type: 'text', title: 'off-brand' }] } },
      },
      {
        id: 'y',
        background: [{ type: 'gm:surface', tone: 'tint' }],
        foreground: { layout: 'free', regions: { default: [{ type: 'chart', chart: 'c1' }] } },
      },
    ],
  }
  const rules = lintGmStory(config as never).filter((i) => i.rule === 'gm-layers-only')
  assert.equal(rules.length, 1)
  assert.equal(rules[0].sectionIndex, 0)
})

test('lint flags sections whose foreground is empty', () => {
  const config = {
    sections: [
      {
        id: 'blank',
        background: [{ type: 'gm:surface', tone: 'light' }],
        foreground: { layout: 'free', regions: { default: [] } },
      },
    ],
  }
  const rules = lintGmStory(config as never).filter((i) => i.rule === 'empty-foreground')
  assert.equal(rules.length, 1)
  assert.equal(rules[0].sectionIndex, 0)
})

test('band rhythm wraps flat foregrounds and stamps surfaces on bare configs', () => {
  const bare = {
    sections: [
      { id: 'a', foreground: [{ type: 'gm:hero', title: 'T' }] },
      { id: 'b', foreground: [{ type: 'gm:prose', title: 'P' }] },
      { id: 'c', foreground: [{ type: 'gm:takeaways', items: [] }] },
    ],
  }
  const out = applyGmBandRhythm(bare as never) as never as FixtureConfig
  for (const s of out.sections) {
    assert.ok(!Array.isArray(s.foreground), `${s.id}: foreground not wrapped into regions form`)
    assert.equal(s.foreground?.layout, 'free')
    const surfaces = (s.background ?? []).filter((l) => l.type === 'gm:surface')
    assert.equal(surfaces.length, 1, `${s.id}: gm:surface not stamped`)
  }
  const tones = out.sections.map((s) => s.background?.[0]?.tone)
  assert.equal(tones[0], 'dark', 'hero opens dark')
  assert.notEqual(tones[1], 'dark', 'content band after the hero must not repeat dark')
})

test('band rhythm handles all three pipeline foreground shapes', () => {
  // normalizeSectionBody emits: bare single layer, flat array, or
  // layout-with-named-regions. Tones and canonicalization must see them all.
  const out = applyGmBandRhythm({
    sections: [
      { id: 'bare', foreground: { type: 'gm:standfirst', text: 'S' } },
      { id: 'named', foreground: { layout: 'centered', regions: { content: [{ type: 'gm:pullquote', text: 'Q' }] } } },
      { id: 'flat', foreground: [{ type: 'gm:takeaways', items: [] }] },
    ],
  } as never) as never as FixtureConfig
  // Bare object wraps into canonical regions form; named-layout form passes through.
  assert.deepEqual(out.sections[0].foreground, {
    layout: 'free',
    regions: { default: [{ type: 'gm:standfirst', text: 'S' }] },
  })
  assert.equal(out.sections[1].foreground?.layout, 'centered')
  // Fixed tones land for every shape: standfirst off, pullquote green, takeaways dark.
  assert.deepEqual(
    out.sections.map((s) => s.background?.[0]?.tone),
    ['off', 'green', 'dark']
  )
})

test('completeGmCoverBody maps the core cover surface into a gm:hero band', () => {
  const body = completeGmCoverBody(
    {
      kind: 'cover',
      eyebrow: 'ESG Careers · 2026 · What employers screen for',
      dek: 'A one-line standfirst.',
      layout: 'hero-full-bleed',
      heading: 'The ESG Career, Reframed',
      panel: { background: 'transparent' },
      foreground: { layout: 'free', regions: { default: [] } },
    },
    { heading: 'The ESG Career, Reframed' }
  )
  const layers = (body.foreground as { regions: { default: Array<Record<string, unknown>> } }).regions.default
  assert.equal(layers.length, 1)
  assert.equal(layers[0].type, 'gm:hero')
  assert.equal(layers[0].title, 'The ESG Career, Reframed')
  assert.equal(layers[0].subtitle, 'A one-line standfirst.')
  assert.deepEqual(layers[0].tags, ['ESG Careers', '2026', 'What employers screen for'])
  for (const dropped of ['layout', 'panel', 'heading', 'eyebrow', 'dek']) {
    assert.ok(!(dropped in body), `core cover field '${dropped}' should be dropped`)
  }
  assert.ok(
    packSchemaByType.get('gm:hero')!.safeParse(layers[0]).success,
    'synthesized hero must satisfy the gm:hero schema'
  )
  // A cover that already carries layers passes through untouched.
  const untouched = { foreground: { type: 'gm:hero', title: 'T' } }
  assert.equal(completeGmCoverBody(untouched, { heading: 'X' }), untouched)
})

test('band rhythm re-tones auto surfaces once layers land, pins hand-set tones', () => {
  // Materialize-time: sections exist but foregrounds are empty placeholders.
  const materialized = applyGmBandRhythm({
    sections: [
      { id: 'a', foreground: { layout: 'free', regions: { default: [] } } },
      { id: 'b', foreground: { layout: 'free', regions: { default: [] } } },
    ],
  } as never) as never as FixtureConfig
  assert.deepEqual(
    materialized.sections.map((s) => s.background?.[0]?.tone),
    ['light', 'tint'],
    'empty sections alternate content tones'
  )
  assert.ok(
    materialized.sections.every((s) => (s.background?.[0] as { auto?: boolean })?.auto === true),
    'stamped surfaces carry the auto provenance flag'
  )

  // VISUAL pass fills the layers; the re-stamp must apply the fixed tones.
  materialized.sections[0].foreground!.regions.default.push({ type: 'gm:hero', title: 'T' })
  materialized.sections[1].foreground!.regions.default.push({ type: 'gm:pullquote', text: 'Q' })
  const retoned = applyGmBandRhythm(materialized as never) as never as FixtureConfig
  assert.deepEqual(
    retoned.sections.map((s) => s.background?.[0]?.tone),
    ['dark', 'green'],
    'auto surfaces re-tone to the fixed tones once the lead layer is known'
  )

  // Hand-tuning: dropping the auto flag pins the tone across regeneration.
  const pinned = structuredClone(retoned)
  pinned.sections[1].background![0] = { type: 'gm:surface', tone: 'pale' }
  const rerun = applyGmBandRhythm(pinned as never) as never as FixtureConfig
  assert.equal(rerun.sections[1].background?.[0]?.tone, 'pale', 'hand-set tone survives re-stamp')
})
