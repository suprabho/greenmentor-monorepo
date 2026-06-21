import Anthropic from "@anthropic-ai/sdk";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { LoadedAgent, AgentRunResult, ToolContext } from "./types";
import { runCallableTool } from "./toolHandlers";
import { getClient } from "../anthropic/client";

const ajv = addFormats(new Ajv({ allErrors: true, strict: false }));

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
    const msg = await client.messages.create({
      model: agent.model,
      max_tokens: agent.maxTokens,
      temperature: agent.temperature,
      system: agent.system,
      tools: [...agent.tools, emitTool],
      tool_choice: forceEmit ? { type: "tool", name: agent.emitToolName } : { type: "auto" },
      messages,
    });
    messages.push({ role: "assistant", content: msg.content });

    const emit = msg.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock =>
        b.type === "tool_use" && b.name === agent.emitToolName,
    );

    if (emit) {
      const output = emit.input as O; // strict tool-use guarantees schema shape
      const valid = ajv.validate(agent.outputSchema, output);
      if (valid) {
        return {
          output,
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
      // Semantic validation failed — retry with the Ajv errors appended.
      lastErrors = ajv.errorsText(ajv.errors);
      messages.push({
        role: "user",
        content: `These fields failed validation, return a corrected ${agent.emitToolName} call: ${lastErrors}`,
      });
      forceEmit = true;
      continue;
    }

    // Run any callable tools the model invoked, append results, continue.
    const calls = msg.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );
    if (calls.length) {
      const results = await Promise.all(
        calls.map(async (c) => ({
          type: "tool_result" as const,
          tool_use_id: c.id,
          content: JSON.stringify(await runCallableTool(c.name, c.input, ctx)),
        })),
      );
      messages.push({ role: "user", content: results });
      continue;
    }

    // Model ended its turn without emitting — force the emit tool next turn.
    forceEmit = true;
  }

  throw new Error(
    `${agent.key}: did not emit a valid result within the turn budget` +
      (lastErrors ? ` (last validation errors: ${lastErrors})` : ""),
  );
}
