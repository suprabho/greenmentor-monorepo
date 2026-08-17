import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'
import { proseSchema, type ProseConfig } from './schema'

// The zod schema is the module's generation AND render contract; it lives in
// ./schema (zod-only imports) so the pack and tests can load it without
// pulling the viz-engine runtime. See ../../pack/index.ts.
export { proseSchema, type ProseConfig } from './schema'

const proseModule: VizModule<ProseConfig> = {
  type: 'gm:prose',
  label: 'GM prose section',
  slots: ['foreground'],
  schema: proseSchema,
  parseConfig: (raw, ctx) => parseWithSchema(proseSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [
    { kind: 'text', key: 'eyebrow', label: 'Eyebrow' },
    { kind: 'text', key: 'title', label: 'Title' },
  ],
}

export default proseModule
