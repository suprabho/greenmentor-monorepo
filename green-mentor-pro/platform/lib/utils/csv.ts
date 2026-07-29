/**
 * Minimal RFC 4180 CSV reader.
 *
 * The repo has no CSV dependency and the one in the lockfile (d3-dsv) is a
 * transitive dep of the vismay packages — importing it from here would be a
 * phantom dependency under pnpm's isolated linker. Hand-rolling is cheap and
 * splitting on "," is genuinely wrong for our inputs: course descriptions
 * contain commas, and an instructor cell can hold "A, B, C" in one quoted field.
 *
 * Handles quoted fields, "" escapes, embedded newlines, CRLF and a leading BOM.
 */

/** Parse CSV text into rows of raw cells. Blank lines are dropped. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch !== '"') {
        field += ch;
        continue;
      }
      // A doubled quote inside a quoted field is a literal quote.
      if (src[i + 1] === '"') {
        field += '"';
        i++;
        continue;
      }
      quoted = false;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  // Trailing field, unless the file ended on a newline.
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/**
 * Parse CSV text using the first row as the header. Cells are trimmed; a row
 * shorter than the header yields "" for the missing columns.
 */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const [header, ...body] = parseCsv(text);
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body.map((cells) =>
    Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? "").trim()])),
  );
}
