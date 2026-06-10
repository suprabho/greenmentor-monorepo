// Static demo data for the Green Mentor Pro prototype. No backend.

export const me = {
  name: "Supro",
  handle: "@supro",
  headline: "Designer → ESG Career Transitioner",
  avatar: "/avatars/supro.jpg",
  xp: 2840,
  streak: 9,
  credits: 1450,
  badges: ["Fundamentals Finisher", "7-Day Streak", "First Comment", "Quiz Ace"],
};

// Stock portraits for demo people (bundled in /public/avatars),
// keyed by every display-name variant used in the UI.
export const avatars: Record<string, string> = {
  Supro: me.avatar,
  "Ananya Iyer": "/avatars/ananya.jpg",
  "Rohan Gupta": "/avatars/rohan.jpg",
  "Meera Krishnan": "/avatars/meera.jpg",
  "Meera K.": "/avatars/meera.jpg",
  "Aditya Sharma": "/avatars/aditya.jpg",
  "Divya Subramaniam": "/avatars/divya.jpg",
  "Divya S.": "/avatars/divya.jpg",
  "Karan Patel": "/avatars/karan.jpg",
  "Tanvi Reddy": "/avatars/tanvi.jpg",
  "Tanvi R.": "/avatars/tanvi.jpg",
  "Vikram N.": "/avatars/vikram.jpg",
  "Arjun P.": "/avatars/arjun.jpg",
};

export const avatarFor = (name: string) => avatars[name];

export type FeedItem = {
  id: string;
  source: string;
  tag: string;
  time: string;
  title: string;
  summary: string;
  likes: number;
  dislikes: number;
  comments: { author: string; text: string }[];
  image?: string;
};

export const feedItems: FeedItem[] = [
  {
    id: "f1",
    source: "SEBI Watch",
    tag: "Regulation",
    time: "2h ago",
    title: "SEBI extends BRSR Core assurance to top 500 listed entities for FY27",
    summary:
      "The glide path widens: reasonable assurance on BRSR Core KPIs now applies to the top 500 by market cap, with value-chain disclosures following in FY28.",
    likes: 214,
    dislikes: 6,
    comments: [
      { author: "Meera K.", text: "Value-chain ESG disclosures are going to be the real bottleneck for mid-caps." },
      { author: "Arjun P.", text: "Time to brush up on assurance readiness — any course recs?" },
    ],
  },
  {
    id: "f2",
    source: "GreenMentor",
    tag: "Webinar",
    time: "5h ago",
    title: "Live next week: Scope 3 Category 1 — getting supplier data that doesn't lie",
    summary:
      "Join our practitioner session on supplier engagement, spend-based vs activity-based estimates, and data quality scoring. Attendance earns 50 credits.",
    image: "/images/feed-webinar.jpg",
    likes: 156,
    dislikes: 2,
    comments: [{ author: "Divya S.", text: "RSVP'd. The last one on materiality was excellent." }],
  },
  {
    id: "f3",
    source: "EU Policy Desk",
    tag: "Global",
    time: "9h ago",
    title: "CSRD Omnibus: simplified ESRS data points published — what survived the cut",
    summary:
      "The simplified standard trims mandatory data points by ~60%. Here's the mapping of what Indian exporters into the EU still need to report.",
    likes: 98,
    dislikes: 11,
    comments: [],
  },
  {
    id: "f4",
    source: "Community",
    tag: "Careers",
    time: "1d ago",
    title: "From audit associate to ESG analyst in 8 months — Ritika's transition story",
    summary:
      "Ritika (BRSR Practitioner track) shares how the Green Learning Profile + two certifications landed her interviews at three Big 4 sustainability teams.",
    image: "/images/feed-careers.jpg",
    likes: 312,
    dislikes: 0,
    comments: [{ author: "Tanvi R.", text: "This is the push I needed. Starting the Fundamental course today." }],
  },
  {
    id: "f5",
    source: "Climate Brief",
    tag: "Climate",
    time: "1d ago",
    title: "India's CCTS carbon market: first compliance cycle prices settle at ₹890/tCO₂e",
    summary:
      "Early trading under the Carbon Credit Trading Scheme gives obligated entities their first real internal carbon price signal.",
    likes: 187,
    dislikes: 4,
    comments: [],
  },
  {
    id: "f6",
    source: "GreenMentor",
    tag: "Product",
    time: "2d ago",
    title: "New in Longsite Lite: demo workspace now includes 12 months of Scope 3 data",
    summary:
      "Practice Category 1–9 calculations on a realistic mid-size manufacturer dataset before touching your own numbers.",
    likes: 142,
    dislikes: 1,
    comments: [],
  },
];

export const webinars = [
  {
    id: "w1",
    date: "Jun 16",
    time: "6:00 PM IST",
    title: "Scope 3 Category 1: supplier data that doesn't lie",
    speaker: "A. Krishnan, GHG practitioner",
    speakerAvatars: ["/avatars/krishnan.jpg"],
    credits: 50,
    rsvp: true,
  },
  {
    id: "w2",
    date: "Jun 19",
    time: "5:00 PM IST",
    title: "BRSR Core assurance: what auditors actually check",
    speaker: "S. Mehta, Partner, Assurance",
    speakerAvatars: ["/avatars/mehta.jpg"],
    credits: 50,
    rsvp: false,
  },
  {
    id: "w3",
    date: "Jun 24",
    time: "7:00 PM IST",
    title: "Materiality assessments that boards take seriously",
    speaker: "Dr. L. Rao",
    speakerAvatars: ["/avatars/rao.jpg"],
    credits: 50,
    rsvp: false,
  },
  {
    id: "w4",
    date: "Jul 02",
    time: "6:30 PM IST",
    title: "Careers AMA: breaking into ESG consulting",
    speaker: "Panel · 4 consultants",
    speakerAvatars: ["/avatars/panel1.jpg", "/avatars/panel2.jpg", "/avatars/panel3.jpg", "/avatars/panel4.jpg"],
    credits: 50,
    rsvp: false,
  },
];

export const esgTasks = [
  { id: "t1", date: "Jun 12", title: "Module 4 gate quiz — ESG Fundamentals", type: "Academy", due: "Due in 2 days" },
  { id: "t2", date: "Jun 15", title: "Final assessment: emissions baseline in Longsite demo", type: "Assessment", due: "Due in 5 days" },
  { id: "t3", date: "Jun 18", title: "Review extracted utility-bill data (Agent run #142)", type: "AI Hub", due: "Waiting on you" },
  { id: "t4", date: "Jun 20", title: "Weekly challenge: complete 5 lessons", type: "Challenge", due: "+500 credits" },
];

export const leaderboard = [
  { rank: 1, name: "Ananya Iyer", xp: 12480, streak: 41, badge: "BRSR Practitioner", delta: "+2" },
  { rank: 2, name: "Rohan Gupta", xp: 11920, streak: 28, badge: "GHG Specialist", delta: "0" },
  { rank: 3, name: "Meera Krishnan", xp: 10870, streak: 35, badge: "Materiality Pro", delta: "+1" },
  { rank: 4, name: "Aditya Sharma", xp: 9640, streak: 12, badge: "Fundamentals Finisher", delta: "-2" },
  { rank: 5, name: "Divya Subramaniam", xp: 9210, streak: 22, badge: "Quiz Ace", delta: "+3" },
  { rank: 6, name: "Karan Patel", xp: 8730, streak: 9, badge: "Community Voice", delta: "0" },
  { rank: 7, name: "Supro", xp: 2840, streak: 9, badge: "7-Day Streak", delta: "+12", me: true },
  { rank: 8, name: "Tanvi Reddy", xp: 2710, streak: 5, badge: "First Steps", delta: "-1" },
];

export const libraryItems = [
  { id: "l1", type: "Recording", title: "Materiality assessments that boards take seriously", meta: "Webinar · 58 min", price: 0 },
  { id: "l2", type: "Guide", title: "BRSR Section C: principle-wise disclosure checklist", meta: "PDF · 34 pages", price: 0 },
  { id: "l3", type: "Template", title: "Supplier ESG data request pack (editable)", meta: "DOCX + XLSX", price: 200 },
  { id: "l4", type: "Recording", title: "CSRD for Indian exporters: a working session", meta: "Webinar · 72 min", price: 150 },
  { id: "l5", type: "Guide", title: "GHG Protocol Scope 2: location vs market-based, explained", meta: "Article · 12 min read", price: 0 },
  { id: "l6", type: "Dataset", title: "India grid emission factors 2020–2026 (CEA-derived)", meta: "CSV · updated quarterly", price: 300 },
];

export type Course = {
  id: string;
  title: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  price: number; // 0 = free
  duration: string;
  modules: number;
  rating: number;
  learners: number;
  tags: string[];
  blurb: string;
  image: string;
  free?: boolean;
};

export const courses: Course[] = [
  {
    id: "c0",
    title: "ESG Fundamentals",
    level: "Beginner",
    price: 0,
    free: true,
    duration: "6 hrs",
    modules: 6,
    rating: 4.8,
    learners: 4210,
    tags: ["esg-basics", "frameworks", "reporting"],
    blurb: "The free on-ramp: what ESG is, why it pays, and how reporting actually works. Free with limitations — certificate and final assessment unlock on upgrade.",
    image: "/images/course-fundamentals.jpg",
  },
  {
    id: "c1",
    title: "BRSR Practitioner",
    level: "Intermediate",
    price: 4000,
    duration: "14 hrs",
    modules: 9,
    rating: 4.7,
    learners: 1830,
    tags: ["brsr", "disclosure", "assurance"],
    blurb: "Section A to C, principle by principle — build a filing-ready BRSR with real disclosures.",
    image: "/images/course-brsr.jpg",
  },
  {
    id: "c2",
    title: "GHG Accounting: Scope 1 & 2",
    level: "Intermediate",
    price: 4000,
    duration: "12 hrs",
    modules: 8,
    rating: 4.9,
    learners: 1510,
    tags: ["ghg", "scope-1", "scope-2"],
    blurb: "Emission factors, activity data, GWP math — compute a defensible corporate footprint.",
    image: "/images/course-ghg.jpg",
  },
  {
    id: "c3",
    title: "Scope 3 Deep Dive",
    level: "Advanced",
    price: 7000,
    duration: "18 hrs",
    modules: 11,
    rating: 4.6,
    learners: 740,
    tags: ["scope-3", "value-chain"],
    blurb: "All 15 categories, estimation hierarchies, supplier engagement, and data quality scoring.",
    image: "/images/course-scope3.jpg",
  },
  {
    id: "c4",
    title: "Materiality & Strategy",
    level: "Intermediate",
    price: 4000,
    duration: "10 hrs",
    modules: 7,
    rating: 4.7,
    learners: 920,
    tags: ["materiality", "strategy"],
    blurb: "Run a double-materiality assessment your board will actually use.",
    image: "/images/course-materiality.jpg",
  },
  {
    id: "c5",
    title: "ESG Data & Reporting Tools",
    level: "Beginner",
    price: 2000,
    duration: "8 hrs",
    modules: 6,
    rating: 4.5,
    learners: 1120,
    tags: ["tools", "longsite", "data"],
    blurb: "Hands-on with Longsite Lite: data entry, dashboards, and your first automated report.",
    image: "/images/course-tools.jpg",
  },
];

export const fundamentalModules = [
  { id: "m1", title: "What ESG actually is", lessons: 5, mins: 38, state: "done" as const },
  { id: "m2", title: "The reporting landscape: BRSR, GRI, CSRD", lessons: 6, mins: 52, state: "done" as const },
  { id: "m3", title: "Environment: emissions, water, waste", lessons: 7, mins: 61, state: "current" as const },
  { id: "m4", title: "Social: workforce, community, supply chain", lessons: 6, mins: 48, state: "locked" as const },
  { id: "m5", title: "Governance: boards, ethics, risk", lessons: 5, mins: 40, state: "locked" as const },
  { id: "m6", title: "Putting it together: your first report", lessons: 5, mins: 45, state: "locked" as const },
];

export const lesson = {
  course: "ESG Fundamentals",
  module: "Module 3 · Environment: emissions, water, waste",
  title: "Scope 1, 2 and 3 — drawing the boundary",
  index: 3,
  total: 7,
  mins: 6,
  body: [
    "Every corporate carbon footprint starts with one question: which emissions are yours? The GHG Protocol answers it with three scopes.",
    "Scope 1 is what you burn — fuel in your boilers, gas in your fleet, refrigerant leaks. Direct emissions from sources you own or control.",
    "Scope 2 is what you buy as energy — purchased electricity, steam, heating and cooling. The emissions happen at the power plant, but they exist because of your demand.",
    "Scope 3 is everything else your business causes — purchased goods, logistics, business travel, product use, end-of-life. For most companies it is 70–90% of the total footprint, and it is where BRSR and CSRD are heading.",
  ],
  keyTakeaway:
    "Scopes are about control and cause: you control Scope 1, you contract Scope 2, you cause Scope 3.",
};

export const quiz = {
  question: "Your company leases a fleet of delivery vans and buys electricity for its warehouse. The vans' fuel emissions and the warehouse electricity fall under…",
  options: [
    { id: "a", text: "Scope 1 (vans) and Scope 2 (electricity)", correct: true },
    { id: "b", text: "Scope 2 for both — they're purchased services", correct: false },
    { id: "c", text: "Scope 3 for both — leased assets are always indirect", correct: false },
    { id: "d", text: "Scope 1 for both — they happen at your sites", correct: false },
  ],
  explanation:
    "Operationally controlled leased vehicles are typically Scope 1; purchased electricity is the classic Scope 2. (Lease accounting nuances come in Module 3, Lesson 6.)",
};

export const courseLeaderboard = [
  { rank: 1, name: "Divya Subramaniam", xp: 980 },
  { rank: 2, name: "Karan Patel", xp: 915 },
  { rank: 3, name: "Supro", xp: 840, me: true },
  { rank: 4, name: "Tanvi Reddy", xp: 760 },
  { rank: 5, name: "Vikram N.", xp: 610 },
];

export type Job = {
  id: string;
  role: string;
  company: string;
  location: string;
  salary: string;
  posted: string;
  match: number;
  skills: { name: string; have: boolean }[];
  type: string;
};

export const jobs: Job[] = [
  {
    id: "j1",
    role: "ESG Analyst",
    company: "Mahindra Sustainability Office",
    location: "Mumbai · Hybrid",
    salary: "₹9–14 LPA",
    posted: "2d ago",
    match: 86,
    type: "Full-time",
    skills: [
      { name: "BRSR", have: true },
      { name: "GHG accounting", have: true },
      { name: "Excel/data", have: true },
      { name: "Assurance readiness", have: false },
    ],
  },
  {
    id: "j2",
    role: "Sustainability Reporting Associate",
    company: "Deloitte India",
    location: "Bengaluru · On-site",
    salary: "₹7–11 LPA",
    posted: "3d ago",
    match: 78,
    type: "Full-time",
    skills: [
      { name: "BRSR", have: true },
      { name: "GRI", have: true },
      { name: "CSRD/ESRS", have: false },
      { name: "Client reporting", have: false },
    ],
  },
  {
    id: "j3",
    role: "Scope 3 Data Specialist",
    company: "Wipro",
    location: "Remote (India)",
    salary: "₹12–18 LPA",
    posted: "5d ago",
    match: 64,
    type: "Full-time",
    skills: [
      { name: "Scope 3 categories", have: false },
      { name: "Supplier engagement", have: false },
      { name: "GHG accounting", have: true },
      { name: "Data quality", have: true },
    ],
  },
  {
    id: "j4",
    role: "ESG Consultant (Mid-level)",
    company: "ERM India",
    location: "Gurugram · Hybrid",
    salary: "₹14–20 LPA",
    posted: "1w ago",
    match: 71,
    type: "Full-time",
    skills: [
      { name: "Materiality", have: true },
      { name: "BRSR", have: true },
      { name: "Decarbonization roadmaps", have: false },
      { name: "Stakeholder workshops", have: false },
    ],
  },
  {
    id: "j5",
    role: "Sustainability Intern",
    company: "Tata Steel",
    location: "Jamshedpur · On-site",
    salary: "₹40k/mo stipend",
    posted: "1w ago",
    match: 92,
    type: "Internship",
    skills: [
      { name: "ESG basics", have: true },
      { name: "Emissions math", have: true },
      { name: "Report drafting", have: true },
    ],
  },
];

export const cvReport = {
  fileName: "Supro_CV_2026.pdf",
  targetRole: "ESG Analyst",
  atsScore: 72,
  strengths: [
    "Quantified design-systems impact translates well to data storytelling",
    "GreenMentor certifications (ESG Fundamentals, in-progress BRSR) verified via profile",
    "Tooling fluency: Longsite Lite portfolio artifacts attached",
  ],
  gaps: [
    { gap: "No assurance-readiness exposure", fix: "BRSR Practitioner · Module 8", course: "BRSR Practitioner" },
    { gap: "Scope 3 vocabulary missing from experience bullets", fix: "Scope 3 Deep Dive · Modules 1–3", course: "Scope 3 Deep Dive" },
    { gap: "No stakeholder-facing deliverables listed", fix: "Materiality & Strategy · Module 5", course: "Materiality & Strategy" },
  ],
  rewrites: [
    {
      before: "Worked on sustainability projects for clients.",
      after: "Built emissions baselines (Scope 1–2, 14 sites) in Longsite for 3 client engagements; flagged 12% overstatement from stale grid factors.",
    },
    {
      before: "Familiar with ESG reporting.",
      after: "Drafted BRSR Principle 6 environmental disclosures end-to-end, including energy intensity and water-stress reporting.",
    },
  ],
};

export const mockInterview = {
  role: "ESG Analyst",
  progress: "Question 3 of 8",
  question:
    "Walk me through how you would build a first-year emissions baseline for a mid-size manufacturer with no prior data collection.",
  hints: ["Boundary first (operational control?)", "Data hierarchy: metered > invoiced > estimated", "Grid factors & GWP versions matter"],
  lastAnswerFeedback: {
    score: 7.5,
    good: "Strong structure: you set the organizational boundary before touching data, and you named primary-data sources first.",
    improve: "You didn't mention data quality scoring or how you'd document estimation assumptions — assessors always probe this.",
  },
};

export const buddyChat = [
  { from: "user" as const, text: "What's the difference between BRSR and BRSR Core?" },
  {
    from: "ai" as const,
    text: "BRSR is the full Business Responsibility & Sustainability Report — Sections A, B and C across all 9 principles. BRSR Core is a focused subset of ~9 KPI groups (GHG intensity, water, waste, employee wellbeing, gender diversity, and more) that requires third-party assurance for the top listed companies. Think of Core as the audited heart of the full report.\n\nSource: Content Library → \"BRSR Section C checklist\"",
  },
  { from: "user" as const, text: "Which of those KPIs could I practice calculating somewhere?" },
  {
    from: "ai" as const,
    text: "Your Longsite Lite demo workspace has 12 months of energy, water and waste data — perfect for GHG intensity and water-consumption KPIs. Want me to hand this to the Data Analyst agent to set up the calculations, or would you rather do it manually as practice? (Manual earns quiz XP.)",
  },
];

export const agentFamilies = [
  {
    id: "comm",
    name: "Communication Agents",
    icon: "ChatCircleText",
    desc: "Stakeholder emails, supplier data requests, sustainability announcements.",
    price: "from 100 cr/run",
    agents: ["Supplier data request", "Stakeholder update", "Internal ESG memo"],
  },
  {
    id: "extract",
    name: "Document Extraction Agents",
    icon: "FileMagnifyingGlass",
    desc: "Pull structured data from utility bills, invoices, and sustainability reports into your workspace.",
    price: "from 150 cr/run",
    agents: ["Utility bill extractor", "Invoice line-items", "Report data miner"],
  },
  {
    id: "plan",
    name: "Planning Agents",
    icon: "Strategy",
    desc: "Materiality plans, decarbonization roadmaps, ESG project plans — tasks land on your calendar.",
    price: "from 250 cr/run",
    agents: ["Materiality planner", "Decarb roadmap draft", "Project planner"],
  },
  {
    id: "analyze",
    name: "Data Analyst & Visualizer Agents",
    icon: "ChartLineUp",
    desc: "Analyze workspace data, build charts, find anomalies, YoY comparisons.",
    price: "from 200 cr/run",
    agents: ["Emissions analyst", "Anomaly finder", "Chart builder"],
  },
  {
    id: "produce",
    name: "Documents & Reports Producer Agents",
    icon: "FileDoc",
    desc: "BRSR section drafts, policies, board summaries — DOCX/PDF/XLSX out.",
    price: "from 300 cr/run",
    agents: ["BRSR section drafter", "Policy writer", "Board summary"],
  },
];

export const workspaces = [
  {
    id: "ws-demo",
    name: "Demo Workspace",
    badge: "Demo data",
    company: "Verdant Mills Pvt Ltd (sample)",
    desc: "12 months of energy, water, waste & Scope 3 data for a mid-size textile manufacturer.",
    updated: "Refreshed weekly",
  },
  {
    id: "ws-1",
    name: "My First Baseline",
    badge: "Free workspace",
    company: "Personal practice",
    desc: "Your own data. Free tier: 500 rows, 1 report export.",
    updated: "Edited 3d ago",
  },
];

export const demoEmissions = {
  company: "Verdant Mills Pvt Ltd",
  period: "FY 2025–26",
  scope1: 4820,
  scope2: 7140,
  scope3: 31600,
  completeness: 78,
  monthly: [3.1, 3.4, 3.2, 3.6, 3.9, 3.7, 3.5, 3.8, 4.1, 3.9, 3.6, 3.8], // ktCO2e
  categories: [
    { name: "Purchased electricity", scope: 2, value: 7140, pct: 16 },
    { name: "Purchased goods (Cat 1)", scope: 3, value: 18200, pct: 42 },
    { name: "Natural gas boilers", scope: 1, value: 3610, pct: 8 },
    { name: "Upstream transport (Cat 4)", scope: 3, value: 6900, pct: 16 },
    { name: "Fleet diesel", scope: 1, value: 1210, pct: 3 },
    { name: "Business travel (Cat 6)", scope: 3, value: 2400, pct: 6 },
  ],
};

export const profileSkills = [
  { name: "ESG fundamentals", level: 92 },
  { name: "Reporting frameworks", level: 78 },
  { name: "GHG accounting", level: 64 },
  { name: "Materiality", level: 41 },
  { name: "Scope 3", level: 22 },
];

export const credentials = [
  { title: "ESG Fundamentals", status: "Certificate locked — upgrade to claim", state: "locked" as const, date: "In progress · 43%" },
  { title: "7-Day Streak ×1", status: "Earned", state: "earned" as const, date: "Jun 2026" },
  { title: "Quiz Ace (10 perfect quizzes)", status: "Earned", state: "earned" as const, date: "May 2026" },
  { title: "BRSR Practitioner", status: "Not started", state: "todo" as const, date: "—" },
];
