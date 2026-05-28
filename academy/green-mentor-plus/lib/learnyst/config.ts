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
 * Course catalog URL — courses link out to per-course Learnyst pages.
 * Real per-course URLs live alongside the course in `lib/data/courses.ts`.
 */
export const LEARNYST_COURSES_URL = `${LEARNYST_BASE_URL}/courses`;
