import type Anthropic from "@anthropic-ai/sdk";

export type AgentModel = "claude-opus-4-8" | "claude-sonnet-4-6" | "claude-haiku-4-5";

export type AgentFamily =
  | "planning"
  | "stakeholder"
  | "requirement"
  | "collection"
  | "validation"
  | "calculation"
  | "drafting"
  | "publication"
  | "orchestrator"
  | "comms";

export interface HitlGate {
  required: boolean;
  gate: string | null; // e.g. "data_quality_signoff"
  blocks_phase: number;
}

/** Shape of skill.md YAML frontmatter. */
export interface AgentFrontmatter {
  name: string;
  description: string;
  model: AgentModel;
  phase: number;
  family: AgentFamily;
  when_to_use: string;
  inputs?: string[];
  outputs?: string[];
  tools: string[]; // subset of tools.json names
  emit_tool?: string;
  hitl_gate: HitlGate;
  version: string; // semver
  prompt_variant?: string; // absent => "control"
  enabled?: boolean; // false => stub (e.g. comms-outreach)
  max_tokens?: number;
  temperature?: number;
}

/** io.schema.json — JSON Schemas live under $defs. */
export interface IoSchema {
  $defs: {
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    [k: string]: Record<string, unknown>;
  };
}

/** A package compiled into a runtime-ready object. */
export interface LoadedAgent {
  key: string; // name, or "name@variant"
  name: string; // logical agent name (shared across variants)
  system: string; // skill.md body == the system prompt
  model: AgentModel;
  phase: number;
  family: AgentFamily;
  tools: Anthropic.Messages.Tool[]; // callable tools, strict:true
  emitToolName: string; // forced final-output tool
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  templates: Record<string, unknown>; // basename -> string | parsed json
  hitlGate: HitlGate;
  version: string;
  promptVariant: string;
  enabled: boolean;
  maxTokens: number;
  temperature: number;
}

export interface AgentRunMeta {
  agent: string;
  model: AgentModel;
  version: string;
  promptVariant: string;
  stopReason: Anthropic.Messages.Message["stop_reason"];
}

export interface AgentRunResult<O> {
  output: O; // validated against outputSchema
  raw: Anthropic.Messages.Message; // full message for audit/debug
  meta: AgentRunMeta;
}

/** Context passed to callable tool handlers — enforces tenant scope server-side. */
export interface ToolContext {
  orgId: string;
  engagementId: string;
  financialYear?: string;
}
