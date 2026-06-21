import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

const ajv = addFormats(new Ajv({ allErrors: true, strict: false }));

const cache = new Map<string, ValidateFunction>();

/** Compile-and-cache a JSON Schema, then validate. Returns { valid, errors }. */
export function validateAgainst(
  schema: Record<string, unknown>,
  data: unknown,
): { valid: boolean; errors: string | null } {
  const key = JSON.stringify(schema);
  let fn = cache.get(key);
  if (!fn) {
    fn = ajv.compile(schema);
    cache.set(key, fn);
  }
  const valid = fn(data) as boolean;
  return { valid, errors: valid ? null : ajv.errorsText(fn.errors) };
}
