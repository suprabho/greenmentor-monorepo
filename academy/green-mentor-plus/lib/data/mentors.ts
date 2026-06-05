/**
 * Mentor roster (A-1) — the practitioners who teach and grade, named at the
 * point of purchase. Rendered by the "Our Mentors" block in AboutSection.
 *
 * Cleaned from LinkedIn profiles. No photos yet, so cards fall back to an
 * initials avatar (same treatment as SocialProof).
 *
 * TODO[mentors]: paste each `linkedinUrl` (profiles confirmed, slugs pending)
 * and add `photo` paths once headshots are supplied.
 */
export interface Mentor {
  name: string;
  /** Current headline / what they do. */
  role: string;
  /** Primary affiliation shown under the role. */
  company?: string;
  /** City / region. */
  location?: string;
  /** Alma mater, shown as a small credential line. */
  education?: string;
  /** 2-letter initials for the avatar circle. */
  initials: string;
  /** Public LinkedIn profile URL. */
  linkedinUrl?: string;
}

export const mentors: Mentor[] = [
  {
    name: "Karuna Kalra",
    role: "ESG & Sustainability Professional",
    company: "Independent advisor",
    location: "United Kingdom",
    education: "The Fletcher School, Tufts University",
    initials: "KK",
  },
  {
    name: "Shreya Kalra",
    role: "Business Sustainability Professional",
    company: "InCorp India",
    location: "New Delhi",
    education: "TERI School of Advanced Studies",
    initials: "SK",
  },
  {
    name: "Amitava Mandal",
    role: "Consulting, Analytics & Project Management",
    company: "Greenmentor",
    location: "India",
    education: "TERI School of Advanced Studies",
    initials: "AM",
  },
  {
    name: "Sumit Jugran",
    role: "Sustainability Professional",
    company: "Value Sustainable",
    location: "Gurugram",
    education: "University of Pune",
    initials: "SJ",
  },
  {
    name: "Vidya Chavan",
    role: "Sustainability Strategy & ESG Specialist",
    // TODO[mentors]: confirm current employer — LinkedIn header lists
    // "Jala-Janaka Pvt Ltd" while the profile summary says KPIT.
    company: "KPIT",
    location: "Pune",
    education: "University of Petroleum & Energy Studies (UPES)",
    initials: "VC",
  },
];
