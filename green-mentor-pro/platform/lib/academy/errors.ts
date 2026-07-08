/** Thrown by lib/academy/progress.ts when a request violates a policy
 * (max attempts, retry cooldown) rather than failing unexpectedly — route
 * handlers catch this and map it to the given HTTP status. */
export class AcademyApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
