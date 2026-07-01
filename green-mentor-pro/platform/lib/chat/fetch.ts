import type { FetchFunction } from "@ai-sdk/provider-utils";

/**
 * fetch wrapper for the chat transport. Turns network + HTTP failures into a
 * `throw new Error(message)` so useChat's `onError`/`error` shows the real cause
 * instead of a silent stall or a raw HTML error page. Mirrors the flp ai-chatbot
 * `fetchWithErrorHandlers`. Runs only in the browser (called by DefaultChatTransport).
 */
export const fetchWithErrorHandlers: FetchFunction = async (input, init) => {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new Error("You appear to be offline. Check your connection and retry.");
    }
    const response = await fetch(input, init);
    if (!response.ok) {
      throw new Error(await extractError(response));
    }
    return response;
  } catch (err) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new Error("You appear to be offline. Check your connection and retry.");
    }
    throw err;
  }
};

/**
 * Pull a human message out of a failed response. Route errors are JSON ({ error }),
 * so this shows the real cause (e.g. "no working model credential"); anything else
 * (an HTML 500) falls back to the status so the banner never shows "Unexpected token '<'".
 */
async function extractError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await response.json()) as { error?: unknown };
      if (body?.error) return String(body.error);
    } catch {
      // fall through to the status-based message
    }
  }
  return `Request failed (${response.status}${response.statusText ? ` ${response.statusText}` : ""}).`;
}
