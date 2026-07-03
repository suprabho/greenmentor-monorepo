/**
 * The standard page shell: a padded column, full-width below xl (tablets get
 * the whole screen) and centered on desktop. Full-screen surfaces (the
 * share-cards studio, the export render page) live outside this group.
 */
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto px-5 py-8 xl:max-w-6xl">{children}</main>;
}
