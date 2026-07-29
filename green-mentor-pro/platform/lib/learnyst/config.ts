/**
 * Learnyst integration constants.
 *
 * TODO[Learnyst]: confirm the real signup URL with Learnyst support
 * and replace LEARNYST_SIGNUP_URL below. The login URL is the customer's
 * Learnyst-hosted school login page.
 */

export const LEARNYST_BASE_URL =
  process.env.NEXT_PUBLIC_LEARNYST_BASE_URL ??
  "https://learn.greenmentor.academy";

export const LEARNYST_SIGNUP_URL = `${LEARNYST_BASE_URL}/signup`;
export const LEARNYST_LOGIN_URL = `${LEARNYST_BASE_URL}/login`;

/**
 * Public course catalog base, used for the bundle/plan CTA.
 *
 * Per-course links are NOT composed from this — each course stores its own
 * absolute `course_url` in public.course_catalog, so the row stays a faithful
 * copy of the intake sheet. That means NEXT_PUBLIC_LEARNYST_CATALOG_URL no
 * longer repoints individual course links at a staging school; it only moves
 * the catalog-level CTA.
 *
 * NOTE: the live catalog is hosted on a different domain/path than the auth base
 * above — it's `academy.greenmentor.co/learn`, not `${LEARNYST_BASE_URL}/courses`.
 * Override via NEXT_PUBLIC_LEARNYST_CATALOG_URL if the host changes.
 */
export const LEARNYST_COURSES_URL =
  process.env.NEXT_PUBLIC_LEARNYST_CATALOG_URL ??
  "https://academy.greenmentor.co/learn";
