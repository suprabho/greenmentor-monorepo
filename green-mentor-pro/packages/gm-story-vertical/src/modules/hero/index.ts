import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'
import { heroSchema, type HeroConfig } from './schema'

// The zod schema is the module's generation AND render contract; it lives in
// ./schema (zod-only imports) so the pack and tests can load it without
// pulling the viz-engine runtime. See ../../pack/index.ts.
export { heroSchema, type HeroConfig } from './schema'

const heroModule: VizModule<HeroConfig> = {
  type: 'gm:hero',
  label: 'GM hero',
  slots: ['foreground'],
  schema: heroSchema,
  parseConfig: (raw, ctx) => parseWithSchema(heroSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [
    {
      kind: 'select',
      key: 'variant',
      label: 'Variant',
      options: [
        { value: 'split', label: 'Split (issue panel right)' },
        { value: 'stacked', label: 'Stacked' },
        { value: 'editorial', label: 'Editorial (no issue panel)' },
        { value: 'bold', label: 'Bold color block' },
      ],
    },
    { kind: 'text', key: 'title', label: 'Title', required: true },
    { kind: 'text', key: 'subtitle', label: 'Subtitle' },
    { kind: 'text', key: 'brandLine', label: 'Brand line' },
    { kind: 'text', key: 'issueNumber', label: 'Issue number' },
    { kind: 'text', key: 'issueDate', label: 'Issue date' },
  ],
}

export default heroModule
