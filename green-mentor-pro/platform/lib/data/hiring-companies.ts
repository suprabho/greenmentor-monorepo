/**
 * Companies hiring ESG talent that our learners have moved into, rendered as a
 * natural-colour logo wall. Split into a prominent top set (always visible) and
 * a long tail (revealed when the user expands).
 *
 * Scoped to companies we hold a transparent-background logo for in
 * `public/brand/logos/` (see docs/hiring-company-logos-brief.md). Square/badge
 * marks carry a taller `className` height so they optically balance the wide
 * wordmarks across the wall.
 */
export type HiringCompany = {
  /** Display / alt name. */
  name: string;
  /** Public path to a transparent-background logo. */
  logo: string;
  /** Optional height override (merged over the default) for square/badge marks. */
  className?: string;
};

export const topHiringCompanies: HiringCompany[] = [
  { name: "Tata", logo: "/brand/logos/tata.svg", className: "h-10 md:h-12" },
  { name: "Reliance", logo: "/brand/logos/reliance.svg" },
  { name: "Mahindra", logo: "/brand/logos/mahindra.svg" },
  { name: "BCG", logo: "/brand/logos/bcg.svg" },
  { name: "EY", logo: "/brand/logos/ey.svg", className: "h-10 md:h-12" },
  { name: "KPMG", logo: "/brand/partner-kpmg.png", className: "h-10 md:h-12" },
  { name: "PwC", logo: "/brand/logos/pwc.svg" },
];

export const moreHiringCompanies: HiringCompany[] = [
  { name: "Shell", logo: "/brand/logos/shell.svg" },
  { name: "Wipro", logo: "/brand/logos/wipro.svg" },
  { name: "Infosys", logo: "/brand/logos/infosys.svg" },
  { name: "HCL", logo: "/brand/logos/hcl.svg" },
  { name: "HDFC Bank", logo: "/brand/logos/hdfc-bank.svg" },
  { name: "Axis Bank", logo: "/brand/logos/axis-bank.svg" },
  { name: "ICICI Bank", logo: "/brand/logos/icici-bank.svg" },
  { name: "Siemens", logo: "/brand/logos/siemens.svg" },
  { name: "Schneider Electric", logo: "/brand/logos/schneider-electric.svg" },
  { name: "ABB", logo: "/brand/logos/abb.svg", className: "h-10 md:h-12" },
  { name: "Unilever", logo: "/brand/logos/unilever.svg", className: "h-10 md:h-12" },
  { name: "P&G", logo: "/brand/logos/pg.svg", className: "h-10 md:h-12" },
  { name: "Hero MotoCorp", logo: "/brand/logos/hero-motocorp.svg", className: "h-10 md:h-12" },
  { name: "Bajaj Auto", logo: "/brand/logos/bajaj-auto.svg", className: "h-10 md:h-12" },
  { name: "Havells", logo: "/brand/logos/havells.svg" },
];
