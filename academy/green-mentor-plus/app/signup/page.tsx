import { redirect } from "next/navigation";

/**
 * v1: signup is the onboarding flow. This route exists so that links
 * like `/signup` from external places land in the right place.
 */
export default function SignupPage() {
  redirect("/onboarding/intro");
}
