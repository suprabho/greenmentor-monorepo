import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'
import { pullquoteSchema, type PullquoteConfig } from './schema'

// The zod schema is the module's generation AND render contract; it lives in
// ./schema (zod-only imports) so the pack and tests can load it without
// pulling the viz-engine runtime. See ../../pack/index.ts.
export { pullquoteSchema, type PullquoteConfig } from './schema'

const pullquoteModule: VizModule<PullquoteConfig> = {
  type: 'gm:pullquote',
  label: 'GM pull quote',
  slots: ['foreground'],
  schema: pullquoteSchema,
  parseConfig: (raw, ctx) => parseWithSchema(pullquoteSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [
    { kind: 'text', key: 'text', label: 'Quote', required: true },
    { kind: 'text', key: 'attribution', label: 'Attribution' },
  ],
}

export default pullquoteModule
