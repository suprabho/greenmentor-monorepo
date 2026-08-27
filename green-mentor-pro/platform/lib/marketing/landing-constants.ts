/**
 * Shared by the server-side sample loader and the client carousel — kept
 * dependency-free so the client bundle never pulls in the Supabase server
 * client through landing-samples.ts.
 */

/** How many cards the feed and jobs slides cycle through. */
export const CYCLE_SIZE = 5;
