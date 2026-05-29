/**
 * Field validation for the onboarding identity step. Kept framework-free so it
 * can run in the client form and be reused for any server-side re-check.
 */
import { countryByIso } from "@/lib/data/country-codes";

/** Strip everything but digits — formatting (spaces, dashes) is cosmetic. */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

// Local-part and domain each disallow whitespace/@, domain needs a dot. This
// is deliberately permissive (we can't truly verify deliverability here) but
// rejects the obvious garbage.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  const email = value.trim();
  // RFC 5321 caps the whole address at 254 chars.
  if (email.length === 0 || email.length > 254) return false;
  return EMAIL_RE.test(email);
}

/**
 * Validate a national number (digits only, no dial code) against the picked
 * country's expected length(s). Falls back to a generic 7–15 digit range for
 * countries without a pinned length so we never block a legitimate number.
 */
export function isValidPhone(national: string, iso: string): boolean {
  const digits = phoneDigits(national);
  const lengths = countryByIso(iso)?.nsnLengths;
  if (lengths && lengths.length > 0) {
    return lengths.includes(digits.length);
  }
  return digits.length >= 7 && digits.length <= 15;
}

/** A human-friendly hint for the expected length, e.g. "Enter a 10-digit number." */
export function phoneLengthHint(iso: string): string {
  const lengths = countryByIso(iso)?.nsnLengths;
  if (!lengths || lengths.length === 0) {
    return "Please enter a valid mobile number.";
  }
  const list =
    lengths.length === 1
      ? `${lengths[0]}-digit`
      : `${lengths.slice(0, -1).join(", ")} or ${lengths[lengths.length - 1]}-digit`;
  return `Please enter a valid ${list} mobile number.`;
}
