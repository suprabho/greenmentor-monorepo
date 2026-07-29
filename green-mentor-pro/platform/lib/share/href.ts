// Paths to the shareable detail pages.
//
// Deliberately its own module with zero imports: these are needed by client
// components (jobs-board, feed cards) as well as server ones, and living in
// lib/{jobs,webinars,feed}/repo.ts would drag lib/supabase/server — and its
// next/headers import — into the browser bundle.

/** Any mapped row; every repo maps `shareSlug` on the way out. */
type Shareable = { shareSlug: string };

export function webinarHref(webinar: Shareable): string {
  return `/webinars/${webinar.shareSlug}`;
}

export function jobHref(job: Shareable): string {
  return `/jobs/${job.shareSlug}`;
}

/** The Green Mentor permalink for a feed post — not the publisher's URL. */
export function articleHref(article: Shareable): string {
  return `/feed/${article.shareSlug}`;
}
