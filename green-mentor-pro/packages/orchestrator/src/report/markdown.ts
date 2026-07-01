import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

marked.setOptions({ gfm: true, breaks: false });

/**
 * Render LLM-generated markdown to SANITIZED HTML. body_markdown / answers are served
 * as an HTML report document and flow into dangerouslySetInnerHTML, so sanitization is
 * mandatory — an injected <script>/<img onerror> would otherwise run.
 *
 * Uses sanitize-html (pure JS, htmlparser2) rather than DOMPurify+isomorphic-dompurify:
 * the latter drags the entire jsdom dependency tree into every @gm/orchestrator
 * consumer, and jsdom's CJS→ESM require() edges crash the Vercel Lambda (ERR_REQUIRE_ESM).
 * The allowlist below is a superset of the tags `marked` emits for GFM.
 */
const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr", "blockquote",
    "strong", "em", "del", "s", "sup", "sub", "span",
    "ul", "ol", "li",
    "pre", "code",
    "a", "img",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "title"],
    img: ["src", "alt", "title"],
    code: ["class"], // language-xxx highlight hints
    span: ["class"],
    // `align` is what marked emits for column alignment; keep `style` too and
    // constrain it to text-align in case a future marked switches to inline CSS.
    th: ["align", "colspan", "rowspan", "style"],
    td: ["align", "colspan", "rowspan", "style"],
  },
  // Block all inline CSS except table cell text-align.
  allowedStyles: {
    th: { "text-align": [/^left$|^right$|^center$/] },
    td: { "text-align": [/^left$|^right$|^center$/] },
  },
  // Blocks javascript:/vbscript: etc.; keeps the usual safe schemes.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  disallowedTagsMode: "discard",
};

export function mdToSafeHtml(md: string): string {
  const raw = marked.parse(md ?? "", { async: false }) as string;
  return sanitizeHtml(raw, SANITIZE_OPTS);
}

/** Escape a plain string for safe HTML interpolation (titles, codes, units). */
export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
