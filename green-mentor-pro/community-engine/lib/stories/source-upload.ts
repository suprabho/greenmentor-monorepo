/**
 * Upload transport, limits and the file-type vocabulary.
 *
 * CLIENT-SAFE on purpose: the compose panel needs the extension list for its file
 * picker and the size ceiling to choose a transport. Keeping these out of
 * `source-extract.ts` matters — that module dynamic-imports the pipeline's ingest
 * tree (pdf-parse, pdfjs, LiteParse's native binding, jsdom), and importing it from
 * a client component would pull all of it toward the browser bundle.
 */

/**
 * Extensions the DETERMINISTIC extractor reads — pure TypeScript, always available.
 */
export const NATIVE_SOURCE_EXTS = [
  ".pdf",
  ".eml",
  ".html",
  ".htm",
  ".csv",
  ".json",
  ".md",
  ".markdown",
  ".txt",
] as const;

/**
 * Office and ebook formats that ONLY markitdown can read.
 *
 * `extract.ts` cannot open these at all — there is no TypeScript path. Microsoft's
 * `markitdown` is a PYTHON CLI, so support is conditional on that binary being
 * callable in the environment (`MARKITDOWN_BIN`, else `markitdown` on PATH).
 * Vismay's own pipeline confines it to an out-of-band extraction worker for exactly
 * this reason.
 *
 * We accept these uploads and probe at extraction time rather than rejecting them
 * up front: a self-hosted runner or a local dev box with the CLI installed handles
 * them fine, and where it is absent the author gets a message naming the two
 * workarounds instead of a flat "unsupported".
 */
export const MARKITDOWN_SOURCE_EXTS = [
  ".docx",
  ".doc",
  ".pptx",
  ".ppt",
  ".xlsx",
  ".xls",
  ".epub",
] as const;

/** Every extension a source upload may carry. */
export const SUPPORTED_SOURCE_EXTS = [
  ...NATIVE_SOURCE_EXTS,
  ...MARKITDOWN_SOURCE_EXTS,
] as const;

export function sourceExtension(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i).toLowerCase();
}

export function isSupportedSourceFile(filename: string): boolean {
  return (SUPPORTED_SOURCE_EXTS as readonly string[]).includes(sourceExtension(filename));
}

/** The private staging bucket for large source uploads (migration 0022). */
export const SOURCE_UPLOAD_BUCKET = "story-source-uploads";

/**
 * Ceiling for a signed upload. Matched by `file_size_limit` on the bucket itself,
 * because a signed URL is a capability handed to a browser — the limit has to be
 * enforced where the write lands, not only where the token is minted.
 */
export const SOURCE_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Ceiling for an INLINE multipart upload. Route-handler bodies cap at ~4.5MB on
 * Vercel, so this is what can arrive in one request; anything larger takes the
 * signed-URL path.
 */
export const INLINE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Guard a client-supplied storage path before reading it.
 *
 * The sources route is handed a path by the client after the direct-to-storage
 * upload. The service-role client bypasses RLS, so an unchecked path would let a
 * caller name ANY object in the bucket — including one uploaded under a different
 * story — and have its text extracted into their own story. Requiring the
 * `<storyId>/` prefix (and rejecting traversal) scopes the read to the story the
 * request is already authorised for.
 */
export function isOwnUploadPath(path: string, storyId: string): boolean {
  if (!path || path.includes("..") || path.startsWith("/")) return false;
  return path.startsWith(`${storyId}/`);
}
