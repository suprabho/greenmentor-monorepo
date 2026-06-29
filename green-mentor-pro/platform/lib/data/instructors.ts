/**
 * Companies where Greenmentor instructors have practitioner experience.
 * Rendered as a monochrome logo wall beneath the hero stats for credibility.
 *
 * Each entry carries an accessible label (`name`) and the public path to a
 * transparent-background logo. The Hero applies `brightness-0 invert` so the
 * logos read as solid white against the dark-teal background.
 */
export type InstructorCompany = {
  /** Display / alt name. */
  name: string;
  /** Public path to a transparent-background logo, e.g. "/brand/logos/ey.svg". */
  logo: string;
  /**
   * Optional per-logo class override, merged over the default height. Square
   * marks (KPMG, Coca-Cola) read smaller than the wide wordmarks at a shared
   * height, so they get a taller height to optically balance the logo wall.
   */
  className?: string;
};

export const instructorCompanies: InstructorCompany[] = [
  { name: "EY", logo: "/brand/logos/ey.svg" },
  { name: "KPMG", logo: "/brand/partner-kpmg.png", className: "h-10 md:h-12" },
  { name: "PwC", logo: "/brand/logos/pwc.svg" },
  { name: "Harvard", logo: "/brand/logos/harvard.svg" },
  { name: "Boeing", logo: "/brand/logos/boeing.svg" },
  { name: "Coca-Cola", logo: "/brand/logos/coca-cola.svg", className: "h-10 md:h-12" },
  { name: "BCG", logo: "/brand/logos/bcg.svg" },
];
