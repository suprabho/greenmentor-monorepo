import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'
import { takeawaysSchema, type TakeawaysConfig } from './schema'

// The zod schema is the module's generation AND render contract; it lives in
// ./schema (zod-only imports) so the pack and tests can load it without
// pulling the viz-engine runtime. See ../../pack/index.ts.
export { takeawaysSchema, type TakeawaysConfig } from './schema'

const takeawaysModule: VizModule<TakeawaysConfig> = {
  type: 'gm:takeaways',
  label: 'GM takeaways',
  slots: ['foreground'],
  schema: takeawaysSchema,
  parseConfig: (raw, ctx) => parseWithSchema(takeawaysSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [
    { kind: 'text', key: 'eyebrow', label: 'Eyebrow' },
    { kind: 'text', key: 'title', label: 'Title' },
    { kind: 'json', key: 'items', label: 'Items (3–5 of {lead, body})' },
  ],
}

export default takeawaysModule
