import { createHash } from "node:crypto";

/**
 * Deterministic UUIDv5-style id derived from a legacy (greenmentor-in-um) numeric
 * id, so the same legacy org/user always maps to the same uuid. Used for
 * `created_by`/`requested_by` columns (which default to auth.uid() — null under the
 * service-role client — and must be supplied explicitly).
 */
const NAMESPACE = "9b2e1c7a-3f4d-5e6b-8a90-1c2d3e4f5a6b"; // fixed GreenMentor namespace

export function legacyUuid(kind: string, id: string | number): string {
  const h = createHash("sha1").update(NAMESPACE).update(`${kind}:${id}`).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; // version 5
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = b.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
