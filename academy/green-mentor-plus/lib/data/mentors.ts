/**
 * Mentor roster (A-1) — the practitioners who teach and grade, named at the
 * point of purchase. Rendered by the "Our Mentors" block in AboutSection.
 *
 * Cleaned from LinkedIn profiles. No photos yet, so cards fall back to an
 * initials avatar. Rendered as an auto-scrolling vertical ticker.
 *
 * TODO[mentors]: paste each `linkedinUrl` (profiles confirmed, slugs pending),
 * add `photo` paths once headshots are supplied, and CONFIRM the `tags` — they
 * are reasonable ESG-domain guesses, not verified specialisms.
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
  /** Expertise chips. Placeholder guesses — confirm before publishing. */
  tags: string[];
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
    tags: ["ESG Strategy", "Sustainability Policy", "Climate Risk"],
  },
  {
    name: "Shreya Kalra",
    role: "Business Sustainability Professional",
    company: "InCorp India",
    location: "New Delhi",
    education: "TERI School of Advanced Studies",
    initials: "SK",
    tags: ["ESG Reporting", "BRSR", "Sustainability Strategy"],
  },
  {
    name: "Amitava Mandal",
    role: "Consulting, Analytics & Project Management",
    company: "Greenmentor",
    location: "India",
    education: "TERI School of Advanced Studies",
    initials: "AM",
    tags: ["ESG Analytics", "Consulting", "Project Management"],
  },
  {
    name: "Sumit Jugran",
    role: "Sustainability Professional",
    company: "Value Sustainable",
    location: "Gurugram",
    education: "University of Pune",
    initials: "SJ",
    tags: ["Sustainability Strategy", "ESG Advisory", "Stakeholder Engagement"],
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
    tags: ["ESG Strategy", "Sustainability Reporting", "Carbon Management"],
  },
];
