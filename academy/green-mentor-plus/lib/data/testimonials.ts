/**
 * Real attributed testimonials sourced from learners' LinkedIn posts.
 * Each row carries the live LinkedIn URL so the home SocialProof section
 * can link out for verification.
 */

export interface Testimonial {
  quote: string;
  name: string;
  /** Short role used as the secondary line under the name. */
  role: string;
  /** Optional company — kept for back-compat with older card layouts. */
  company?: string;
  /** 2-letter initials shown in the avatar circle. */
  initials: string;
  /** Public LinkedIn post URL the quote was lifted from. */
  linkedinUrl: string;
}

export const testimonials: Testimonial[] = [
  {
    quote:
      "An incredible learning journey with Greenmentor — the ESG content, community and mentorship made all the difference.",
    name: "Swetaleena Panda",
    role: "ESG Professional",
    initials: "SP",
    linkedinUrl:
      "https://www.linkedin.com/posts/msswetaleenapanda_esg-greenmentor-sustainabilityjourney-ugcPost-7348413937949777920-Yt3Q/",
  },
  {
    quote:
      "Continuous learning with Greenmentor has been a game-changer. The structured path and expert sessions kept me motivated.",
    name: "CA Bhoomi Shah",
    role: "ESG Student",
    initials: "BS",
    linkedinUrl:
      "https://www.linkedin.com/posts/ca-bhoomi-shah-589b25235_esgstudent-continuouslearning-greenmentor-share-7434662750116818944-IHhA/",
  },
  {
    quote:
      "Greenmentor's circularity and sustainability courses are practical, well-structured and relevant to real industry challenges.",
    name: "Dr. Kathir R",
    role: "Sustainability Professional",
    initials: "KR",
    linkedinUrl:
      "https://www.linkedin.com/posts/dr-kathir-r-30615924_sustainability-circularity-continuouslearning-share-7389685622971666432-O5RC/",
  },
  {
    quote:
      "Loving the weekend sessions — practical, engaging and directly applicable to real sustainability roles.",
    name: "Lauretta Bright",
    role: "ESG Learner",
    initials: "LB",
    linkedinUrl:
      "https://www.linkedin.com/posts/lauretta-bright-92678123a_happysunday-share-7460715033426300928-sXMX/",
  },
  {
    quote:
      "Completed the LCA course — the depth of content and real project exposure was outstanding. Highly recommend.",
    name: "Prasad Aslekar",
    role: "LCA Course Graduate",
    initials: "PA",
    linkedinUrl:
      "https://www.linkedin.com/posts/prasad-aslekar-72aba415_certificate-of-completion-lca-ugcPost-7457304925635670016-StRD/",
  },
  {
    quote:
      "The ESG and BRSR content at Greenmentor is top-notch. Clear, practical and directly useful for sustainability roles.",
    name: "Ravikiran Gare",
    role: "ESG & BRSR Professional",
    initials: "RG",
    linkedinUrl:
      "https://www.linkedin.com/posts/ravikiran-gare-b0b035287_esg-sustainability-brsr-share-7454789831961989120-0PsP/",
  },
  {
    quote:
      "GHG Accounting with Greenmentor gave me the ISO 14064 and carbon neutrality knowledge I needed to level up professionally.",
    name: "Chandramohan TS",
    role: "GHG Accounting Learner",
    initials: "CT",
    linkedinUrl:
      "https://www.linkedin.com/posts/chandramohants_ghgaccounting-iso14064-carbonneutrality-share-7452618429607612417-BWnm/",
  },
];

export const trustStrip = {
  headline: "Powered by India's biggest ESG Community",
  subline:
    "40,000+ learners and 5,000+ professionals — building the same muscle, faster.",
};
