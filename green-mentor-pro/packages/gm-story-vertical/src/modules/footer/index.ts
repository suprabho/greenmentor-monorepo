import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'
import { footerSchema, type FooterConfig } from './schema'

// The zod schema is the module's generation AND render contract; it lives in
// ./schema (zod-only imports) so the pack and tests can load it without
// pulling the viz-engine runtime. See ../../pack/index.ts.
export { footerSchema, type FooterConfig } from './schema'

const footerModule: VizModule<FooterConfig> = {
  type: 'gm:footer',
  label: 'GM footer',
  slots: ['foreground'],
  schema: footerSchema,
  parseConfig: (raw, ctx) => parseWithSchema(footerSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [
    { kind: 'text', key: 'logo', label: 'Logo text' },
    { kind: 'text', key: 'tagline', label: 'Tagline' },
    { kind: 'json', key: 'columns', label: 'Columns (exactly 3 of {label, body})' },
    { kind: 'text', key: 'copyright', label: 'Copyright' },
  ],
}

export default footerModule
