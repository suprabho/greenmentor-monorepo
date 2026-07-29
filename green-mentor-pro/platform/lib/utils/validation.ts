/**
 * Field validation for the onboarding identity step. Kept framework-free so it
 * can run in the client form and be reused for the server-side re-check in
 * PATCH /api/profile.
 *
 * Ported from academy/green-mentor-plus (lib/utils/validation). The email
 * validator is dropped here — the platform user is already authenticated, so
 * the address comes from auth.users rather than a form field.
 */
import { countryByIso } from "@/lib/data/country-codes";

/** Strip everything but digits — formatting (spaces, dashes) is cosmetic. */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Display names are stored on profiles.display_name and shown in the shell. */
export function isValidName(value: string): boolean {
  return value.trim().length >= 2;
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

/**
 * Join a picked country + national number into the E.164-ish form we persist
 * ("+919876543210"). Mirrors what the plus welcome step did inline at submit.
 */
export function toE164(national: string, iso: string): string {
  const dial = countryByIso(iso)?.dial ?? "";
  return `${dial}${phoneDigits(national)}`;
}

/**
 * Inverse of {@link toE164} — split a stored phone back into the national
 * number the input expects. The stored `phone_country` tells us which dial
 * code to strip; without it we can only hand back the digits.
 */
export function fromE164(phone: string | null | undefined, iso: string): string {
  if (!phone) return "";
  const dial = countryByIso(iso)?.dial;
  if (dial && phone.startsWith(dial)) return phone.slice(dial.length);
  return phoneDigits(phone);
}
