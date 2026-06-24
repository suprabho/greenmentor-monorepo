import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

/**
 * Singleton Anthropic client (Node runtime). Reads ANTHROPIC_API_KEY from env.
 * maxRetries is raised from the SDK default (2) so transient 429/5xx/529 "overloaded"
 * responses auto-recover with exponential backoff instead of failing the phase.
 */
export function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    _client = new Anthropic({ maxRetries: 5 });
  }
  return _client;
}
