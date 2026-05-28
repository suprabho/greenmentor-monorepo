export interface NavLink {
  href: string;
  label: string;
}

export const primaryNav: NavLink[] = [
  { href: "/courses", label: "Courses" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
];

export const footerSections: Array<{ title: string; links: NavLink[] }> = [
  {
    title: "Platform",
    links: [
      { href: "/courses", label: "Course Library" },
      { href: "/pricing", label: "Pricing" },
      { href: "/onboarding/intro", label: "Get Started" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/about#mentors", label: "Mentors" },
      { href: "/about#contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/refunds", label: "Refunds" },
    ],
  },
];
