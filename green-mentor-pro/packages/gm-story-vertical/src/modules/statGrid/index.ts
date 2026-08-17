import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'
import { statGridSchema, type StatGridConfig } from './schema'

// The zod schema is the module's generation AND render contract; it lives in
// ./schema (zod-only imports) so the pack and tests can load it without
// pulling the viz-engine runtime. See ../../pack/index.ts.
export { statGridSchema, type StatGridConfig } from './schema'

const statGridModule: VizModule<StatGridConfig> = {
  type: 'gm:statGrid',
  label: 'GM stat grid',
  slots: ['foreground'],
  schema: statGridSchema,
  parseConfig: (raw, ctx) => parseWithSchema(statGridSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [
    { kind: 'text', key: 'eyebrow', label: 'Eyebrow' },
    { kind: 'text', key: 'title', label: 'Title' },
    { kind: 'json', key: 'items', label: 'Stats ({value, unit, label, note})' },
  ],
}

export default statGridModule
