import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'
import { scoreDonutSchema, type ScoreDonutConfig } from './schema'

// The zod schema is the module's generation AND render contract; it lives in
// ./schema (zod-only imports) so the pack and tests can load it without
// pulling the viz-engine runtime. See ../../pack/index.ts.
export { scoreDonutSchema, type ScoreDonutConfig } from './schema'

const scoreDonutModule: VizModule<ScoreDonutConfig> = {
  type: 'gm:scoreDonut',
  label: 'GM score ring',
  slots: ['foreground'],
  schema: scoreDonutSchema,
  parseConfig: (raw, ctx) => parseWithSchema(scoreDonutSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [
    { kind: 'text', key: 'eyebrow', label: 'Eyebrow' },
    { kind: 'text', key: 'title', label: 'Title' },
    { kind: 'number', key: 'value', label: 'Score' },
    { kind: 'number', key: 'max', label: 'Out of' },
    { kind: 'text', key: 'label', label: 'Caption' },
    { kind: 'text', key: 'note', label: 'Note' },
  ],
}

export default scoreDonutModule
