import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'
import { calloutSchema, type CalloutConfig } from './schema'

// The zod schema is the module's generation AND render contract; it lives in
// ./schema (zod-only imports) so the pack and tests can load it without
// pulling the viz-engine runtime. See ../../pack/index.ts.
export { calloutSchema, type CalloutConfig } from './schema'

const calloutModule: VizModule<CalloutConfig> = {
  type: 'gm:callout',
  label: 'GM callout box',
  slots: ['foreground'],
  schema: calloutSchema,
  parseConfig: (raw, ctx) => parseWithSchema(calloutSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [
    { kind: 'text', key: 'title', label: 'Title', required: true },
    { kind: 'text', key: 'badge', label: 'Badge' },
    { kind: 'json', key: 'items', label: 'List items' },
  ],
}

export default calloutModule
