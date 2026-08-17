import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyGmBandRhythm } from './applyGmBandRhythm'

test('re-stamps a fixed-tone module to its correct tone even when a gm:surface was stamped earlier against an empty placeholder', () => {
  // Materialize pass: section appended with an empty foreground, band
  // rhythm stamped before the module type is known.
  const materialized = applyGmBandRhythm({
    sections: [
      { foreground: { layout: 'free', regions: { default: [] } } },
    ],
  })
  const stamped = (materialized.sections[0] as any).background[0]
  assert.equal(stamped.type, 'gm:surface')
  assert.notEqual(stamped.tone, 'green')

  // Visual pass: the real gm:pullquote layer is filled in, then the band
  // rhythm is re-stamped. The pullquote must end up on its fixed 'green'
  // tone, not the placeholder tone from the materialize pass.
  const withContent = {
    sections: [
      {
        ...materialized.sections[0],
        foreground: {
          layout: 'free',
          regions: { default: [{ type: 'gm:pullquote', text: 'Quote.' }] },
        },
      },
    ],
  }
  const revisited = applyGmBandRhythm(withContent)
  const finalBg = (revisited.sections[0] as any).background[0]
  assert.equal(finalBg.type, 'gm:surface')
  assert.equal(finalBg.tone, 'green')
})

test('leaves a hand-tuned content-band tone untouched on re-stamp', () => {
  const config = {
    sections: [
      {
        foreground: { layout: 'free', regions: { default: [{ type: 'gm:body' }] } },
        background: [{ type: 'gm:surface', tone: 'tint' }],
      },
    ],
  }
  const revisited = applyGmBandRhythm(config)
  const finalBg = (revisited.sections[0] as any).background[0]
  assert.equal(finalBg.tone, 'tint')
})
