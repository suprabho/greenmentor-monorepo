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
  { number: "5,000+", caption: "Professionals trained" },
  { number: "40,000+", caption: "ESG learners community" },
  { number: "10+", caption: "Live ESG courses" },
  { number: "50+", caption: "Companies hiring" },
];
