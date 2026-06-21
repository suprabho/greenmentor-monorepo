import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

/** Singleton Anthropic client (Node runtime). Reads ANTHROPIC_API_KEY from env. */
export function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    _client = new Anthropic();
  }
  return _client;
}
