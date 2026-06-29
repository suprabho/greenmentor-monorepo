/**
 * Mentor roster (A-1) — the practitioners who teach and grade, named at the
 * point of purchase. Rendered by the "Our Mentors" block in AboutSection.
 *
 * Cleaned from LinkedIn profiles. Headshots live under /public/mentors; cards
 * fall back to an initials avatar when `photo` is absent. Rendered as an
 * auto-scrolling vertical ticker.
 *
 * TODO[mentors]: paste each `linkedinUrl` (profiles confirmed, slugs pending),
 * and CONFIRM the `tags` — they are reasonable ESG-domain guesses, not
 * verified specialisms.
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
  /** 2-letter initials for the avatar circle when no photo is set. */
  initials: string;
  /** Headshot path under /public. Falls back to initials when absent. */
  photo?: string;
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
    photo: "/mentors/karuna.jpeg",
    tags: ["ESG Strategy", "Sustainability Policy", "Climate Risk"],
  },
  {
    name: "Shreya Kalra",
    role: "Business Sustainability Professional",
    company: "InCorp India",
    location: "New Delhi",
    education: "TERI School of Advanced Studies",
    initials: "SK",
    photo: "/mentors/shreya.jpeg",
    tags: ["ESG Reporting", "BRSR", "Sustainability Strategy"],
  },
  {
    name: "Amitava Mandal",
    role: "Consulting, Analytics & Project Management",
    company: "Greenmentor",
    location: "India",
    education: "TERI School of Advanced Studies",
    initials: "AM",
    photo: "/mentors/amitava.jpeg",
    tags: ["ESG Analytics", "Consulting", "Project Management"],
  },
  {
    name: "Sumit Jugran",
    role: "Sustainability Professional",
    company: "Value Sustainable",
    location: "Gurugram",
    education: "University of Pune",
    initials: "SJ",
    photo: "/mentors/sumit.jpeg",
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
    photo: "/mentors/vidya.jpeg",
    tags: ["ESG Strategy", "Sustainability Reporting", "Carbon Management"],
  },
  {
    name: "Vishal Pandhare",
    role: "Global Sustainability Consultant",
    // Founder & Director, Ecomantra (Nov 2024–present). 24+ years across
    // sustainability and design & development; 8+ years in ESG, CDP, GHG
    // (Scope 1/2/3), LCA, EPD.
    company: "Ecomantra Sustainable Engineering",
    location: "Pune",
    initials: "VP",
    photo: "/mentors/vishal.jpeg",
    tags: ["CBAM", "GHG Accounting", "LCA & EPD"],
  },
];
