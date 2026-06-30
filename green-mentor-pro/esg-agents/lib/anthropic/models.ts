// Re-export shim — canonical runtime lives in @gm/agents. Import from the @gm/agents/models
// subpath (NOT the barrel): the barrel's `export * from "./loadAgent"` pulls node:fs into any
// client bundle that touches MODELS (e.g. PipelineBoard → pipeline → here), failing the webpack
// build with "UnhandledSchemeError: node:fs". The subpath resolves straight to the client-safe
// model registry, so loadAgent is never reached.
export { MODELS, supportsTemperature } from "@gm/agents/models";
export type { ModelTier } from "@gm/agents/models";
