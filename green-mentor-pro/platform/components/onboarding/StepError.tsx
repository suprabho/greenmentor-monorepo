/**
 * Save-failure banner for the onboarding steps. Mirrors the app's usual inline
 * error treatment, re-toned for the dark teal shell.
 */
export function StepError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mt-5 rounded-[8px] border border-danger/40 bg-danger/15 px-4 py-3 text-[14px] text-white"
    >
      {message}
    </p>
  );
}
