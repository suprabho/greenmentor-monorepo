import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'
import { explainerGridSchema, type ExplainerGridConfig } from './schema'

// The zod schema is the module's generation AND render contract; it lives in
// ./schema (zod-only imports) so the pack and tests can load it without
// pulling the viz-engine runtime. See ../../pack/index.ts.
export { explainerGridSchema, type ExplainerGridConfig } from './schema'

const explainerGridModule: VizModule<ExplainerGridConfig> = {
  type: 'gm:explainerGrid',
  label: 'GM explainer grid',
  slots: ['foreground'],
  schema: explainerGridSchema,
  parseConfig: (raw, ctx) => parseWithSchema(explainerGridSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [
    { kind: 'text', key: 'eyebrow', label: 'Eyebrow' },
    { kind: 'text', key: 'title', label: 'Title' },
    { kind: 'json', key: 'cards', label: 'Cards ({number, label, description})' },
    { kind: 'number', key: 'activeIndex', label: 'Inverted card index' },
  ],
}

export default explainerGridModule
