import Anthropic from "@anthropic-ai/sdk";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { LoadedAgent, AgentRunResult, ToolContext } from "./types";
import { getClient } from "./anthropic/client";
import { supportsTemperature } from "./anthropic/models";

const ajv = addFormats(new Ajv({ allErrors: true, strict: false }));

/**
 * Dispatcher for callable (grounding) tools an agent may invoke mid-run. The
 * infra-coupled implementations live in each consumer — esg-agents wires its
 * DB/EFDB handlers, the platform per-run wires lightweight stubs — and are
 * injected here, so this runtime package depends on no app's infrastructure.
 */
export type CallableToolFn = (
  name: string,
  input: unknown,
  ctx: ToolContext,
) => Promise<unknown> | unknown;

/** A coarse liveness signal emitted once per agent turn so callers can stream progress. */
export interface AgentProgressEvent {
  turn: number; // 1-based turn number in the grounding loop
  note: string; // human-readable, e.g. "thinking…" or "using select_frameworks"
}

export interface RunAgentOptions {
  runCallableTool?: CallableToolFn;
  onProgress?: (ev: AgentProgressEvent) => void;
}

/**
 * Bind a LoadedAgent to an Anthropic strict tool-use call — identical to the
 * community-engine header/draft route, plus a grounding loop for callable tools.
 *
 * - Phase A (grounding): tools = [...callableTools, emitTool], tool_choice: auto.
 *   The model may call callable tools; we run each via toolHandlers and re-call.
 * - Phase B (forced emit): if the model stops without emitting, re-issue with
 *   tool_choice forced to the emit tool so the next turn MUST be the structured call.
 * - Output is Ajv-validated against outputSchema; up to 2 retries append errors.
 */
export async function runAgent<I, O>(
  agent: LoadedAgent,
  input: I,
  ctx: ToolContext,
  opts: RunAgentOptions = {},
): Promise<AgentRunResult<O>> {
  if (!agent.enabled) throw new Error(`${agent.key} is a disabled stub — not runnable in v1`);

  const client = getClient();

  const emitTool: Anthropic.Messages.Tool = {
    name: agent.emitToolName,
    description: "Emit the final structured result. Call this exactly once when finished.",
    // strict tool-use guarantees the JSON shape matches outputSchema.
    input_schema: agent.outputSchema as Anthropic.Messages.Tool["input_schema"],
  };

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: JSON.stringify(input) },
  ];

  let forceEmit = false;
  let lastErrors: string | null = null;

  for (let turn = 0; turn < 8; turn++) {
    // Emit BEFORE the (slow, 10–30s) model call so streamed callers see liveness
    // while the turn is in flight rather than only after it returns.
    opts.onProgress?.({ turn: turn + 1, note: forceEmit ? "finalizing result…" : "thinking…" });
    const msg = await client.messages.create({
      model: agent.model,
      max_tokens: agent.maxTokens,
      // Some newer models (e.g. Opus 4.8) reject the deprecated `temperature` param.
      ...(supportsTemperature(agent.model) ? { temperature: agent.temperature } : {}),
      system: agent.system,
      tools: [...agent.tools, emitTool],
      tool_choice: forceEmit ? { type: "tool", name: agent.emitToolName } : { type: "auto" },
      messages,
    });
    messages.push({ role: "assistant", content: msg.content });

    const toolUses = msg.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );

    // No tool call this turn — nudge the model to emit on the next turn.
    if (toolUses.length === 0) {
      forceEmit = true;
      continue;
    }

    // Valid emit → done. Check first so we can return without running other tools.
    const emit = toolUses.find((b) => b.name === agent.emitToolName);
    if (emit) {
      if (ajv.validate(agent.outputSchema, emit.input)) {
        return {
          output: emit.input as O, // strict tool-use + Ajv validation guarantee the shape
          raw: msg,
          meta: {
            agent: agent.key,
            model: agent.model,
            version: agent.version,
            promptVariant: agent.promptVariant,
            stopReason: msg.stop_reason,
          },
        };
      }
      lastErrors = ajv.errorsText(ajv.errors);
    }

    // Anthropic requires every tool_use to be answered by a tool_result in the next
    // message. Run callable tools; turn an invalid emit into an error result that
    // asks for a corrected call (instead of a stray text message, which would leave
    // the emit tool_use unpaired and 400).
    const calledTools = toolUses.map((b) => b.name).filter((n) => n !== agent.emitToolName);
    if (calledTools.length) opts.onProgress?.({ turn: turn + 1, note: `using ${calledTools.join(", ")}` });

    const toolResults = await Promise.all(
      toolUses.map(async (b) =>
        b.name === agent.emitToolName
          ? {
              type: "tool_result" as const,
              tool_use_id: b.id,
              is_error: true,
              content: `These fields failed validation; call ${agent.emitToolName} again with corrections: ${lastErrors}`,
            }
          : {
              type: "tool_result" as const,
              tool_use_id: b.id,
              content: JSON.stringify(
                opts.runCallableTool
                  ? await opts.runCallableTool(b.name, b.input, ctx)
                  : { ok: false, error: `callable tool '${b.name}' is not available in this run context` },
              ),
            },
      ),
    );
    messages.push({ role: "user", content: toolResults });
    if (emit) forceEmit = true; // an invalid emit was present — force a clean retry next turn
  }

  throw new Error(
    `${agent.key}: did not emit a valid result within the turn budget` +
      (lastErrors ? ` (last validation errors: ${lastErrors})` : ""),
  );
}
