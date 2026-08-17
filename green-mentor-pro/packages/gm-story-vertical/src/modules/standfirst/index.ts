import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'
import { standfirstSchema, type StandfirstConfig } from './schema'

// The zod schema is the module's generation AND render contract; it lives in
// ./schema (zod-only imports) so the pack and tests can load it without
// pulling the viz-engine runtime. See ../../pack/index.ts.
export { standfirstSchema, type StandfirstConfig } from './schema'

const standfirstModule: VizModule<StandfirstConfig> = {
  type: 'gm:standfirst',
  label: 'GM standfirst',
  slots: ['foreground'],
  schema: standfirstSchema,
  parseConfig: (raw, ctx) => parseWithSchema(standfirstSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [{ kind: 'text', key: 'text', label: 'Standfirst', required: true }],
}

export default standfirstModule
