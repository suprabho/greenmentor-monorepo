"use client";

import type { ReactNode } from "react";
import type { PhaseKey } from "@/lib/orchestrator/pipeline";
import { Empty, RawJsonDetails, STAGE_MD_CSS } from "./primitives";
import KickoffStage from "./KickoffStage";
import MaterialityStage from "./MaterialityStage";
import DataRequirementsStage from "./DataRequirementsStage";
import DataCollectionStage from "./DataCollectionStage";
import DataValidationStage from "./DataValidationStage";
import CalculationStage from "./CalculationStage";
import ReportDraftingStage from "./ReportDraftingStage";
import PublicationStage from "./PublicationStage";

export interface StageViewProps {
  phase: PhaseKey;
  payload: unknown;
  /** Append the collapsible raw-JSON fallback (default true). */
  showRawJson?: boolean;
  /** Suppress the kickoff "Open questions" card (the board renders them interactively). */
  hideKickoffQuestions?: boolean;
}

/**
 * Read-only, specialized renderer for a phase's JSON artifact. Dispatches on
 * PhaseKey; each stage component reads `o` defensively (all fields optional).
 */
export function StageView({ phase, payload, showRawJson = true, hideKickoffQuestions = false }: StageViewProps) {
  if (payload == null || typeof payload !== "object") {
    return <Empty>No artifact yet — run this phase.</Empty>;
  }
  const o = payload as Record<string, unknown>;

  let body: ReactNode;
  switch (phase) {
    case "kickoff":
      body = <KickoffStage o={o} hideOpenQuestions={hideKickoffQuestions} />;
      break;
    case "materiality":
      body = <MaterialityStage o={o} />;
      break;
    case "data_requirements":
      body = <DataRequirementsStage o={o} />;
      break;
    case "data_collection":
      body = <DataCollectionStage o={o} />;
      break;
    case "data_validation":
      body = <DataValidationStage o={o} />;
      break;
    case "calculation":
      body = <CalculationStage o={o} />;
      break;
    case "report_drafting":
      body = <ReportDraftingStage o={o} />;
      break;
    case "publication":
      body = <PublicationStage o={o} />;
      break;
    default:
      body = <Empty>Unknown phase.</Empty>;
  }

  return (
    <div>
      <style>{STAGE_MD_CSS}</style>
      {body}
      {showRawJson && <RawJsonDetails value={payload} />}
    </div>
  );
}

export default StageView;
