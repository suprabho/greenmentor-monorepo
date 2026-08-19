import {
  MARKITDOWN_SOURCE_EXTS,
  sourceExtension as extOf,
} from "./source-upload";

/**
 * SERVER-ONLY. Text extraction for uploaded source files.
 *
 * Shared by the two upload paths — the inline multipart POST and the signed-URL
 * flow for larger files — so a 3MB PDF and a 20MB one are read by exactly the same
 * code, and only the transport differs.
 *
 * THE HEAVY INGEST DEPS LIVE BEHIND THIS MODULE. `extractBuffer` and
 * `extractPdfLite` pull pdf-parse / pdfjs / LiteParse's native binding / jsdom.
 * They are declared in `serverExternalPackages` (plus a webpack externals hatch —
 * see next.config.ts) and LiteParse's `.node` + `.so` are force-traced only for the
 * route paths that import this. Import it anywhere else and that route's function
 * grows the same tail.
 */

export { isSupportedSourceFile, sourceExtension } from "./source-upload";

/**
 * Ceiling on the text STORED per source.
 *
 * The pipeline clips each source to 12,000 characters when it renders a prompt
 * (`MAX_SOURCE_CHARS` in story-pipeline's prompts.ts), so text beyond that is never
 * read by a model. Storing it anyway is not free: `listStorySources` selects the
 * whole row, and every compose call in the flow loads it — a 25MB annual report
 * would extract to megabytes of `text` dragged over the wire per angle, per
 * outline, per band.
 *
 * 200k is deliberately generous rather than tight to the 12k clip: a longer context
 * window or a per-source override later should not require re-uploading the file,
 * and 200KB per row is still nothing. What gets dropped is recorded on the row so
 * an author knows the tail was cut rather than never present.
 */
export const MAX_STORED_SOURCE_CHARS = 200_000;

export {
  MARKITDOWN_SOURCE_EXTS,
  NATIVE_SOURCE_EXTS,
  SUPPORTED_SOURCE_EXTS,
} from "./source-upload";

export interface SourceExtraction {
  text: string;
  /**
   * Present when the extraction succeeded but is not trustworthy — a scanned PDF
   * whose text layer is nearly empty. Recorded on the source row so an author sees
   * WHY a draft grounded in it would be thin, instead of discovering it later in
   * the prose.
   */
  warning: string | null;
}

/**
 * Extract text from an uploaded file's bytes.
 *
 * PDF strategy — two DETERMINISTIC extractors, no model in the loop:
 *   1. LiteParse first. It is local and fast, reconstructs the headings and tables a
 *      flat text layer loses, and returns a page-density signal.
 *   2. If that comes back sparse and markitdown is available, try markitdown and
 *      keep whichever produced more text. It is a genuinely different reader
 *      (pdfminer via a Python CLI), so it sometimes recovers a layout LiteParse
 *      projects away.
 *
 * The pipeline also ships `extractPdfVision`, which transcribes page images with a
 * model. It is deliberately NOT used: a transcriber is a generator, and a source
 * document is the one thing in this pipeline that must not be invented. Where both
 * deterministic readers come back thin the document is a scan, and the right answer
 * is to say so — the author can run OCR themselves or paste the passage that
 * matters. Extraction stays a parsing problem, not a generation one.
 */
export async function extractSourceFile(
  buf: Buffer,
  filename: string
): Promise<SourceExtraction> {
  const ext = extOf(filename);

  // Office / ebook formats: markitdown or nothing.
  if ((MARKITDOWN_SOURCE_EXTS as readonly string[]).includes(ext)) {
    const text = await tryMarkitdown(buf, filename);
    if (!text) {
      throw new Error(
        `Could not read ${ext}. These formats need Microsoft's markitdown CLI — set MARKITDOWN_BIN ` +
          `or put \`markitdown\` on PATH. Otherwise export the document to PDF and upload that, or ` +
          `paste the text directly.`
      );
    }
    return clip(text, null);
  }

  if (ext === ".pdf") {
    const { extractPdfLite } = await import("@vismay/story-pipeline");
    const { source, assessment } = await extractPdfLite(buf, { label: filename });
    let text = source.body.trim();
    if (!assessment.shouldEscalate) return clip(text, null);

    // Sparse: give markitdown a turn. A different reader on the same bytes, not a
    // model guessing at page images.
    const viaMarkitdown = await tryMarkitdown(buf, filename);
    if (viaMarkitdown.length > text.length) {
      text = viaMarkitdown;
      // It recovered more than LiteParse — no longer worth warning about.
      if (text.replace(/\s/g, "").length / Math.max(1, assessment.pageCount) >= 200) {
        return clip(text, null);
      }
    }
    return clip(
      text,
      `Only ~${Math.round(text.replace(/\s/g, "").length / Math.max(1, assessment.pageCount))} ` +
        `characters per page across ${assessment.pageCount} page(s) — this looks like a scanned or ` +
        `image-only PDF, and both extractors came back thin. What was extracted is stored, but run OCR ` +
        `on the file or paste the passage that matters for a grounded draft.`
    );
  }
  const { extractBuffer } = await import("@vismay/story-pipeline");
  const out = await extractBuffer(buf, ext);
  return clip(out.body.trim(), null);
}

/**
 * Run markitdown if it is callable, else return "". Never throws — this is always a
 * fallback path, and a missing CLI or a conversion failure must not lose the text
 * the primary extractor already produced.
 */
async function tryMarkitdown(buf: Buffer, filename: string): Promise<string> {
  try {
    const { isMarkitdownAvailable, extractWithMarkitdown } = await import("@vismay/story-pipeline");
    if (!(await isMarkitdownAvailable())) return "";
    const out = await extractWithMarkitdown(buf, { label: filename });
    return out.body.trim();
  } catch {
    return "";
  }
}

/** Bound the stored text, folding any truncation note into the row's warning. */
function clip(text: string, warning: string | null): SourceExtraction {
  if (text.length <= MAX_STORED_SOURCE_CHARS) return { text, warning };
  const note =
    `Extracted ${text.length.toLocaleString()} characters; the first ` +
    `${MAX_STORED_SOURCE_CHARS.toLocaleString()} were kept. Generation reads the first 12,000 of ` +
    `those, so trim the file to the relevant pages if the part that matters is further in.`;
  return {
    text: text.slice(0, MAX_STORED_SOURCE_CHARS),
    warning: warning ? `${warning} ${note}` : note,
  };
}

/**
 * HTML → text via the pipeline's extractor (Mozilla readability), falling back to
 * a tag-stripper.
 *
 * Readability drops the nav/ads/boilerplate a regex pass keeps, which matters
 * because every extra kilobyte of chrome displaces real source text inside the
 * prompt budget. The fallback stays because readability legitimately returns
 * nothing on a page with no article-shaped content, and a source row with SOME
 * text beats one marked failed.
 */
export async function extractHtmlBody(
  html: string,
  fallback: (html: string) => string
): Promise<string> {
  try {
    const { extractBuffer } = await import("@vismay/story-pipeline");
    const out = await extractBuffer(Buffer.from(html, "utf8"), ".html");
    const body = out.body.trim();
    if (body) return body;
  } catch {
    // Fall through to the caller's stripper.
  }
  return fallback(html);
}
