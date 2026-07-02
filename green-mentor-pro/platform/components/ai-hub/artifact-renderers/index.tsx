"use client";

import { Value } from "./generic";
import { ScopePlanArtifact, isScopePlanPayload } from "./scope-plan";

/**
 * Artifact renderer dispatch. Known payload shapes get a purpose-built layout;
 * everything else falls through to the resilient generic renderer, and the
 * detail view always offers a raw JSON toggle as the ultimate fallback, so an
 * unknown/renamed type never crashes.
 *
 * Dispatch is by payload shape (not artifact_type) so a renamed or re-phased
 * artifact keeps its rich rendering.
 */
export function renderArtifact(_artifactType: string, _phaseKey: string, payload: unknown) {
  if (isScopePlanPayload(payload)) return <ScopePlanArtifact payload={payload} />;
  return <Value v={payload} />;
}
