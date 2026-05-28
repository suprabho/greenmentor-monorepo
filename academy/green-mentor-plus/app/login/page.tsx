import { redirect } from "next/navigation";
import { LEARNYST_LOGIN_URL } from "@/lib/learnyst/config";

/**
 * v1: login is handled entirely by Learnyst. We just bounce.
 *
 * In v2, this page will host a passwordless email-link flow that calls our
 * SSO endpoint, then redirects to Learnyst with a one-time token.
 */
export default function LoginPage() {
  redirect(LEARNYST_LOGIN_URL);
}
