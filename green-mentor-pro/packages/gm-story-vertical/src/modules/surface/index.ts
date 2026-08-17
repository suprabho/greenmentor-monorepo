import type { VizModule } from '@vismay/viz-engine'
import { parseWithSchema } from '@vismay/viz-engine'
import { surfaceSchema, type SurfaceConfig } from './schema'

// The zod schema is the module's generation AND render contract; it lives in
// ./schema (zod-only imports) so the pack and tests can load it without
// pulling the viz-engine runtime. See ../../pack/index.ts.
export { surfaceSchema, type SurfaceConfig } from './schema'

const surfaceModule: VizModule<SurfaceConfig> = {
  type: 'gm:surface',
  label: 'GM surface band',
  slots: ['background'],
  schema: surfaceSchema,
  parseConfig: (raw, ctx) => parseWithSchema(surfaceSchema, raw, ctx),
  load: () => import('./Component'),
  loadPersistent: () => import('./Persistent'),
  mountingMode: 'persistent-aggregated',
  // Constant identity: every unit's gm:surface layer collapses into a single
  // persistent mount that repaints per active unit.
  stableIdentity: () => 'gm:surface',
  readinessProfile: 'instant',
  adminForm: () => [
    {
      kind: 'select',
      key: 'tone',
      label: 'Band tone',
      options: [
        { value: 'light', label: 'Light (paper)' },
        { value: 'tint', label: 'Green tint' },
        { value: 'pale', label: 'Pale green' },
        { value: 'off', label: 'Off-white' },
        { value: 'dark', label: 'Dark (ink)' },
        { value: 'green', label: 'Green (brand)' },
        { value: 'page', label: 'Page grey' },
      ],
    },
  ],
}

export default surfaceModule
