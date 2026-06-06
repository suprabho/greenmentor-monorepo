/**
 * Four headline stats shown in the hero band — the "credibility upfront"
 * device from the v3 HTML. Numbers ladder up from individuals to the
 * institutions hiring them.
 */
export interface HeroStat {
  number: string;
  caption: string;
}

export const heroStats: HeroStat[] = [
  { number: "5,000+", caption: "Professionals trained across 12+ industries" },
  { number: "40,000+", caption: "Active ESG learners, India's largest" },
  { number: "8", caption: "Live & self-paced ESG courses" },
  { number: "50+", caption: "Top companies hiring from our community" },
];
