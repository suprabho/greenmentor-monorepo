import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'
import { comparisonTableSchema, type ComparisonTableConfig } from './schema'

// The zod schema is the module's generation AND render contract; it lives in
// ./schema (zod-only imports) so the pack and tests can load it without
// pulling the viz-engine runtime. See ../../pack/index.ts.
export { comparisonTableSchema, type ComparisonTableConfig } from './schema'

const comparisonTableModule: VizModule<ComparisonTableConfig> = {
  type: 'gm:comparisonTable',
  label: 'GM comparison table',
  slots: ['foreground'],
  schema: comparisonTableSchema,
  parseConfig: (raw, ctx) => parseWithSchema(comparisonTableSchema, raw, ctx),
  load: () => import('./Component'),
  readinessProfile: 'instant',
  defaultStyle: { pointerEvents: 'none' },
  adminForm: () => [
    { kind: 'text', key: 'eyebrow', label: 'Eyebrow' },
    { kind: 'text', key: 'title', label: 'Title' },
    { kind: 'json', key: 'columns', label: 'Columns (string[])' },
    { kind: 'json', key: 'rows', label: 'Rows (string[][])' },
    { kind: 'number', key: 'highlightColumn', label: 'Highlight column (0-based)', min: 0, step: 1 },
  ],
}

export default comparisonTableModule
