/**
 * Contact details captured when a learner RSVPs to a webinar.
 *
 * Phone handling is deliberately not reinvented here: onboarding already asks
 * for a number through components/onboarding/PhoneInput and stores it on
 * profiles as E.164 plus the ISO country that produced the dial code (migration
 * 0025). This reuses that model and lib/utils/validation, so there's one phone
 * format in the database and international numbers work — for most learners the
 * RSVP form is just confirming what onboarding already collected.
 *
 * Email is still a field rather than being taken from the session: someone who
 * signed up with a personal address often wants the joining link at their work
 * one, the same reason the ESG-readiness form asks for a work email.
 *
 * Kept zod-free so importing it into the client form doesn't pull zod into the
 * browser bundle; the route layers a zod schema on top for shape validation.
 */

import { isValidName, isValidPhone } from "@/lib/utils/validation";

/**
 * What the RSVP form starts with. `phone` is the *national* number (digits
 * only, no dial code) to match what PhoneInput binds to; `phoneCountry` is the
 * ISO-3166 alpha-2 backing the dial code. Submit joins them with toE164().
 */
export interface RsvpContactDefaults {
  fullName: string;
  email: string;
  phone: string;
  phoneCountry: string;
}

export type RsvpContactField = "fullName" | "email" | "phone";

/** Placeholder for signed-out renders, which show "Sign in to RSVP" instead of
 *  the form. Empty strings, never null — these feed controlled inputs. */
export const EMPTY_RSVP_CONTACT: RsvpContactDefaults = {
  fullName: "",
  email: "",
  phone: "",
  phoneCountry: "",
};

// lib/utils/validation drops email on purpose (onboarding takes it from
// auth.users), so the check lives here.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidRsvpEmail(raw: string): boolean {
  const v = raw.trim();
  return v.length <= 200 && EMAIL_RE.test(v);
}

/**
 * Field-level errors keyed by field; an empty object means valid. Returned
 * rather than thrown so the form can show all three at once. The phone entry is
 * a marker — the form renders phoneLengthHint(iso) for it, which knows the
 * expected digit count for the picked country.
 */
export function validateRsvpContact(
  input: RsvpContactDefaults
): Partial<Record<RsvpContactField, string>> {
  const errors: Partial<Record<RsvpContactField, string>> = {};
  if (!isValidName(input.fullName)) errors.fullName = "Tell us your name";
  else if (input.fullName.trim().length > 200) errors.fullName = "That name is too long";
  if (!isValidRsvpEmail(input.email)) errors.email = "Enter a valid email address";
  if (!isValidPhone(input.phone, input.phoneCountry)) errors.phone = "invalid";
  return errors;
}
