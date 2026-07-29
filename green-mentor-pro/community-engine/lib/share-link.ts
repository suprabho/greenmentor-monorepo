// Public deeplinks to the learner platform, for the admin hub to show and copy.
//
// The platform builds these from lib/share/slug.ts, but nothing needs
// re-deriving here: `slug` and `id_prefix` are both filled by the
// gm_set_share_keys() trigger (migration 0017_shareable_slugs.sql), so this is
// pure string assembly. A row missing either column predates the migration —
// fall back to the bare uuid, which the platform's resolver still accepts.

const DEFAULT_PLATFORM_URL = "https://app.greenmentor.co";

export interface ShareKeys {
  id: string;
  slug?: string | null;
  id_prefix?: string | null;
}

function platformOrigin(): string {
  return (process.env.NEXT_PUBLIC_PLATFORM_URL || DEFAULT_PLATFORM_URL).replace(/\/+$/, "");
}

function segment(row: ShareKeys): string {
  return row.slug && row.id_prefix ? `${row.slug}-${row.id_prefix}` : row.id;
}

export function publicWebinarUrl(row: ShareKeys): string {
  return `${platformOrigin()}/webinars/${segment(row)}`;
}

export function publicJobUrl(row: ShareKeys): string {
  return `${platformOrigin()}/jobs/${segment(row)}`;
}
