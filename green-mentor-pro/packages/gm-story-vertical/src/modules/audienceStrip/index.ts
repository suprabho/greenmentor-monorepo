import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'
import { audienceStripSchema, type AudienceStripConfig } from './schema'

// The zod schema is the module's generation AND render contract; it lives in
// ./schema (zod-only imports) so the pack and tests can load it without
// pulling the viz-engine runtime. See ../../pack/index.ts.
export { audienceStripSchema, type AudienceStripConfig } from './schema'

const audienceStripModule: VizModule<AudienceStripConfig> = {
  type: 'gm:audienceStrip',
  label: 'GM audience strip',
  slots: ['foreground'],
  schema: audienceStripSchema,
  parseConfig: (raw, ctx) => parseWithSchema(audienceStripSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [
    { kind: 'text', key: 'label', label: 'Label' },
    { kind: 'json', key: 'chips', label: 'Chips (exactly 4)' },
  ],
}

export default audienceStripModule
