import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'
import { ctaSchema, type CtaConfig } from './schema'

// The zod schema is the module's generation AND render contract; it lives in
// ./schema (zod-only imports) so the pack and tests can load it without
// pulling the viz-engine runtime. See ../../pack/index.ts.
export { ctaSchema, type CtaConfig } from './schema'

const ctaModule: VizModule<CtaConfig> = {
  type: 'gm:cta',
  label: 'GM call to action',
  slots: ['foreground'],
  schema: ctaSchema,
  parseConfig: (raw, ctx) => parseWithSchema(ctaSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  // The only foreground module that takes pointer events: its button is the
  // one thing in a story the reader is meant to click.
  defaultStyle: { pointerEvents: 'auto' },
  adminForm: () => [
    { kind: 'text', key: 'eyebrow', label: 'Eyebrow' },
    { kind: 'text', key: 'title', label: 'Title', required: true },
    { kind: 'text', key: 'body', label: 'Body' },
    { kind: 'text', key: 'actionLabel', label: 'Button text', required: true },
    { kind: 'text', key: 'actionHref', label: 'Button URL', required: true },
    { kind: 'text', key: 'note', label: 'Small print' },
  ],
}

export default ctaModule
