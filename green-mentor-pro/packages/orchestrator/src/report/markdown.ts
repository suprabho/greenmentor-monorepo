import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

marked.setOptions({ gfm: true, breaks: false });

/**
 * Render LLM-generated markdown to SANITIZED HTML. body_markdown / answers flow into
 * dangerouslySetInnerHTML AND into Chromium setContent (run with --no-sandbox), so
 * sanitization is mandatory — an injected <script>/<img onerror> would otherwise run.
 */
export function mdToSafeHtml(md: string): string {
  const raw = marked.parse(md ?? "", { async: false }) as string;
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
}

/** Escape a plain string for safe HTML interpolation (titles, codes, units). */
export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
