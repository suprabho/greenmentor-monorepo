// esg-agents binds the shared @gm/agents runtime to ITS callable-tool handlers
// (DB / EFDB / orchestrator grounding). The runtime lives in @gm/agents;
// toolHandlers stays here because it depends on esg-agents infrastructure.
// This wrapper preserves the original 3-arg call signature used across the app.
import { runAgent as coreRunAgent, type RunAgentOptions } from "@gm/agents";
import type { LoadedAgent, AgentRunResult, ToolContext } from "@gm/agents";
import { runCallableTool } from "./toolHandlers";

export function runAgent<I, O>(
  agent: LoadedAgent,
  input: I,
  ctx: ToolContext,
  opts: RunAgentOptions = {},
): Promise<AgentRunResult<O>> {
  return coreRunAgent<I, O>(agent, input, ctx, { runCallableTool, ...opts });
}
