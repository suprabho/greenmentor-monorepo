/**
 * Parser for the participant/attendee CSVs Zoom exports after a session.
 *
 * We have no Zoom REST credentials, so the authoritative attendance list reaches
 * us as a file an admin downloads from Zoom and uploads in the Webinars panel.
 * Zoom emits several shapes depending on whether it was a meeting or a webinar
 * and which report you pick, so this is deliberately tolerant rather than tied
 * to one header set:
 *
 *   Meeting participants:  Name (Original Name) | User Email | Join Time |
 *                          Leave Time | Duration (Minutes) | Guest
 *   Webinar attendees:     Attended | First Name | Last Name | Email |
 *                          Join Time | Leave Time | Time in Session (minutes) | …
 *   Registration reports additionally carry a Phone column.
 *
 * All of them prefix the real table with a summary block and a blank line, so we
 * locate the header row by looking for an email-ish column instead of assuming
 * line 1. Rejoins appear as several rows for one person and are aggregated.
 */

export interface ZoomParticipant {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  /** Summed across rejoins. */
  durationMinutes: number | null;
  /** Earliest join / latest leave, ISO. Null when Zoom's timestamps are unparseable. */
  joinedAt: string | null;
  leftAt: string | null;
}

export interface ParsedZoomReport {
  participants: ZoomParticipant[];
  /** Things the admin should know: skipped rows, missing columns, no-shows dropped. */
  warnings: string[];
}

/**
 * Minimal RFC 4180 reader — quoted fields, "" escapes, and newlines inside
 * quotes (Zoom quotes display names, which can contain commas).
 *
 * Same shape as platform/lib/utils/csv.ts. Duplicated rather than shared because
 * the two Next apps have separate module graphs, like components/ui.tsx.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  // Strip a UTF-8 BOM; Zoom's exports usually carry one and it would otherwise
  // become part of the first header cell.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  // Trailing field/row when the file doesn't end in a newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const norm = (s: string): string => s.trim().toLowerCase();
const isBlankRow = (row: string[]): boolean => row.every((c) => c.trim() === "");

interface ColumnMap {
  name: number;
  firstName: number;
  lastName: number;
  email: number;
  phone: number;
  duration: number;
  joinTime: number;
  leaveTime: number;
  attended: number;
}

/** Find a column whose header contains any of `needles`. -1 when absent. */
function findCol(header: string[], needles: string[], exclude: string[] = []): number {
  return header.findIndex((h) => {
    const v = norm(h);
    if (exclude.some((x) => v.includes(x))) return false;
    return needles.some((n) => v.includes(n));
  });
}

function mapColumns(header: string[]): ColumnMap {
  return {
    // "Name (Original Name)" / "Name". Exclude first/last so they don't collide,
    // and exclude "user name"-style columns that hold a Zoom account id.
    name: findCol(header, ["name"], ["first", "last", "user name", "username", "country", "region"]),
    firstName: findCol(header, ["first name"]),
    lastName: findCol(header, ["last name"]),
    email: findCol(header, ["email"]),
    phone: findCol(header, ["phone", "mobile"]),
    // "Duration (Minutes)" / "Time in Session (minutes)".
    duration: findCol(header, ["duration", "time in session"]),
    joinTime: findCol(header, ["join time"]),
    leaveTime: findCol(header, ["leave time"]),
    attended: findCol(header, ["attended"]),
  };
}

/** A row is the header if it names an email column and some form of name. */
function looksLikeHeader(row: string[]): boolean {
  const cols = mapColumns(row);
  const hasName = cols.name >= 0 || cols.firstName >= 0 || cols.lastName >= 0;
  return cols.email >= 0 && hasName;
}

/**
 * The summary block Zoom puts above the table can itself look header-ish — it
 * carries "User Email" and, on some exports, "Host Name" — and mistaking it for
 * the table would import the host as a participant. A per-person table always
 * has a "Join Time" column and the summary never does (it has Start/End Time),
 * so prefer a row with one and only fall back to the looser rule.
 */
function findHeaderIndex(rows: string[][]): number {
  const strict = rows.findIndex((r) => looksLikeHeader(r) && mapColumns(r).joinTime >= 0);
  return strict >= 0 ? strict : rows.findIndex(looksLikeHeader);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cell = (row: string[], i: number): string => (i >= 0 && i < row.length ? row[i].trim() : "");

/**
 * Zoom writes timestamps in the account's own timezone with no offset
 * ("08/03/2026 10:01:23 AM"), so this resolves against whatever zone the server
 * runs in — good enough for "roughly when they joined", not for arithmetic.
 * Unparseable values become null rather than an Invalid Date.
 */
function parseTime(raw: string): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function parseDuration(raw: string): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Merge a rejoin row into the participant we already have for that person. */
function merge(into: ZoomParticipant, add: ZoomParticipant): void {
  into.fullName ??= add.fullName;
  into.email ??= add.email;
  into.phone ??= add.phone;
  if (add.durationMinutes != null) {
    into.durationMinutes = (into.durationMinutes ?? 0) + add.durationMinutes;
  }
  if (add.joinedAt && (!into.joinedAt || add.joinedAt < into.joinedAt)) into.joinedAt = add.joinedAt;
  if (add.leftAt && (!into.leftAt || add.leftAt > into.leftAt)) into.leftAt = add.leftAt;
}

export function parseZoomParticipantCsv(text: string): ParsedZoomReport {
  const warnings: string[] = [];
  const rows = parseCsv(text).filter((r) => !isBlankRow(r));
  if (rows.length === 0) return { participants: [], warnings: ["That file is empty."] };

  const headerIdx = findHeaderIndex(rows);
  if (headerIdx === -1) {
    return {
      participants: [],
      warnings: [
        "Couldn't find a participant table in that file — it needs a header row with an email column and a name column. Export the participants/attendees report from Zoom rather than the summary.",
      ],
    };
  }

  const header = rows[headerIdx];
  const cols = mapColumns(header);
  if (cols.duration < 0) warnings.push("No duration column found — watch time will be blank.");
  if (cols.phone < 0) {
    warnings.push("No phone column in this export — numbers come from RSVPs instead.");
  }

  // Keyed by lowercased email, or by lowercased name when Zoom has no email for
  // a participant (dial-in and some guests).
  const byKey = new Map<string, ZoomParticipant>();
  let skipped = 0;
  let noShows = 0;

  for (const row of rows.slice(headerIdx + 1)) {
    // Multi-section exports repeat a header, and some end with a footer line.
    if (looksLikeHeader(row)) continue;

    // Webinar attendee reports list registrants who never showed up.
    const attended = cell(row, cols.attended);
    if (attended && /^(no|false|0)$/i.test(attended)) {
      noShows++;
      continue;
    }

    const emailRaw = cell(row, cols.email);
    const email = EMAIL_RE.test(emailRaw) ? emailRaw.toLowerCase() : null;
    const joined = [cell(row, cols.firstName), cell(row, cols.lastName)].filter(Boolean).join(" ");
    const fullName = cell(row, cols.name) || joined || null;

    if (!email && !fullName) {
      skipped++;
      continue;
    }

    const participant: ZoomParticipant = {
      fullName,
      email,
      phone: cell(row, cols.phone) || null,
      durationMinutes: parseDuration(cell(row, cols.duration)),
      joinedAt: parseTime(cell(row, cols.joinTime)),
      leftAt: parseTime(cell(row, cols.leaveTime)),
    };

    const key = email ?? `name:${fullName!.toLowerCase()}`;
    const existing = byKey.get(key);
    if (existing) merge(existing, participant);
    else byKey.set(key, participant);
  }

  if (noShows > 0) warnings.push(`Skipped ${noShows} registrant${noShows === 1 ? "" : "s"} marked as not attended.`);
  if (skipped > 0) warnings.push(`Skipped ${skipped} row${skipped === 1 ? "" : "s"} with no name or email.`);

  return { participants: [...byKey.values()], warnings };
}
