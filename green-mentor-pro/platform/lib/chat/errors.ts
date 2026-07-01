import { NextResponse } from "next/server";

/**
 * Typed errors for the AI Hub chat routes. Modeled on the Vercel ai-chatbot
 * ChatSDKError, scaled down: every known failure maps to a stable HTTP status and
 * a user-facing message, and NEVER leaks an HTML error page. The client fetches
 * call `res.json()`/parse the stream unconditionally, so an unhandled throw (which
 * Next renders as HTML) otherwise surfaces as "Unexpected token '<'". Pairs with
 * `jsonError()` in lib/api-error.ts for the truly-unexpected tail.
 *
 * Server-only (imports next/server). The client just reads `error.message`.
 */

export type ChatErrorCode =
  | "unauthorized"
  | "not_found"
  | "bad_request"
  | "no_model_credential"
  | "offline"
  | "internal";

const STATUS: Record<ChatErrorCode, number> = {
  unauthorized: 401,
  not_found: 404,
  bad_request: 400,
  no_model_credential: 503,
  offline: 503,
  internal: 500,
};

const DEFAULT_MESSAGE: Record<ChatErrorCode, string> = {
  unauthorized: "Please sign in to continue.",
  not_found: "This conversation no longer exists.",
  bad_request: "The chat request was malformed. Please retry.",
  no_model_credential:
    "Chat has no working model credential. Set ANTHROPIC_API_KEY (or AI_GATEWAY_API_KEY) in green-mentor-pro/platform/.env.local and restart.",
  offline: "You appear to be offline. Check your connection and retry.",
  internal: "Something went wrong. Please retry.",
};

export class ChatError extends Error {
  readonly code: ChatErrorCode;
  readonly status: number;
  constructor(code: ChatErrorCode, message?: string) {
    super(message ?? DEFAULT_MESSAGE[code]);
    this.name = "ChatError";
    this.code = code;
    this.status = STATUS[code];
  }
  toResponse(): NextResponse {
    return NextResponse.json({ error: this.message, code: this.code }, { status: this.status });
  }
}

/**
 * Best-effort classification of an unknown throw into a ChatError. Recognizes the
 * two failure modes that keep breaking chat: a missing Supabase service-role key
 * (createAdminClient) and a missing model credential. Everything else is `internal`
 * but still returns JSON with the real message.
 */
export function toChatError(e: unknown): ChatError {
  if (e instanceof ChatError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  if (/service[_ ]?role|SUPABASE_SERVICE_ROLE_KEY|createAdminClient/i.test(msg))
    return new ChatError("internal", "Server is misconfigured (missing SUPABASE_SERVICE_ROLE_KEY).");
  if (/api[_ ]?key|gateway|credential|unauthor|forbidden|\b401\b|\b403\b/i.test(msg))
    return new ChatError("no_model_credential");
  return new ChatError("internal", msg);
}
