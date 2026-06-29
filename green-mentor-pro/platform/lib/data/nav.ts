export interface NavLink {
  href: string;
  label: string;
}

export const primaryNav: NavLink[] = [
  { href: "/#courses", label: "Academy" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#teams", label: "For Teams" },
  { href: "/#about", label: "Platform" },
  { href: "/#faq", label: "FAQ" },
];

export const footerSections: Array<{ title: string; links: NavLink[] }> = [
  {
    title: "Platform",
    links: [
      { href: "/#courses", label: "Course Library" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/#teams", label: "For Teams" },
      { href: "/login", label: "Get Started" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/#about", label: "About" },
      { href: "/#mentors", label: "Mentors" },
      { href: "/#contact", label: "Contact" },
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
