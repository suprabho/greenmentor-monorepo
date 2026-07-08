/**
 * The real "ESG Fundamentals" course: module structure + gate questions,
 * transcribed from the course Google Drive folder and its "Assessment" doc
 * (drive folder 1QrWFF8834iFqHRHeHbkyL5G9QZiMfQXL, owner vizmaya@promad.design).
 * Consumed by scripts/import-academy-course.ts, which matches each module's
 * `folder` to a subfolder of the locally-downloaded Drive folder.
 *
 * Per-video questions are pooled into one module-gate assessment per module
 * (the PRD's module-gate model). Modules whose videos have no questions in the
 * Assessment doc yet get no gate — the course state machine treats a module
 * without an assessment as complete once its lessons are watched.
 */

export type SeedQuestion = {
  stem: string;
  options: { key: "a" | "b" | "c" | "d"; text: string }[];
  correctKey: "a" | "b" | "c" | "d";
  topicTag: string;
};

export type SeedModule = {
  folder: string; // exact Drive subfolder name
  slug: string;
  title: string;
  description: string;
  questions: SeedQuestion[];
};

export const COURSE = {
  trackSlug: "esg-foundations",
  trackTitle: "ESG Career Foundations",
  slug: "esg-fundamentals",
  title: "ESG Fundamentals",
  description:
    "The complete on-ramp to ESG: what it is, how it evolved, India's regulatory landscape, BRSR reporting, and the career paths it opens — in bite-sized video lessons.",
  level: "beginner" as const,
  priceCredits: 0,
};

const q = (
  stem: string,
  options: [string, string, string, string],
  correctKey: SeedQuestion["correctKey"],
  topicTag: string
): SeedQuestion => ({
  stem,
  options: [
    { key: "a", text: options[0] },
    { key: "b", text: options[1] },
    { key: "c", text: options[2] },
    { key: "d", text: options[3] },
  ],
  correctKey,
  topicTag,
});

export const MODULES: SeedModule[] = [
  {
    folder: "Introduction",
    slug: "introduction",
    title: "Introduction to ESG",
    description: "What ESG is, why capital and consumers care, and the three pillars broken down.",
    questions: [
      q(
        "What percentage of consumers are not willing to invest in or buy products from companies that do not take proper care of the environment, their employees, or the community?",
        ["50%", "67%", "76%", "88%"],
        "c",
        "esg-intro"
      ),
      q(
        "By 2025, ESG-mandated assets are projected to make up half of all professionally managed investments. What is the estimated total value of these investments?",
        ["$10 Trillion", "$25 Trillion", "$35 Trillion", "$50 Trillion"],
        "c",
        "esg-intro"
      ),
      q(
        "Which specific sustainability reporting standard, mandated by SEBI in India, is a core focus of the course agenda?",
        [
          "Corporate Sustainability Reporting Directive (CSRD)",
          "Business Responsibility and Sustainability Reporting (BRSR)",
          "Global Reporting Initiative (GRI)",
          "Task Force on Climate-related Financial Disclosures (TCFD)",
        ],
        "b",
        "esg-intro"
      ),
      q(
        "What portion of organization suppliers in India are currently reported as being fully ESG-ready?",
        ["Less than half", "27%", "15%", "45%"],
        "c",
        "esg-readiness"
      ),
      q(
        "How does the speaker interpret the massive compliance gaps and lack of reporting awareness among Indian enterprises?",
        [
          "As an insurmountable market risk that will choke off international venture investment permanently",
          "As a highly lucrative career opportunity for skilled individuals to build up expertise, step into the gap, and solve corporate compliance issues",
          "As an indication that India should build its own alternative governance indicators detached from global frameworks",
          "As a minor public relations issue that requires communication strategies rather than concrete workflow adjustments",
        ],
        "b",
        "esg-readiness"
      ),
      q(
        "What is the primary feature that distinguishes ESG from Sustainability and CSR?",
        [
          "It is solely focused on corporate philanthropy",
          "It serves as a quantifiable assessment of sustainability and business practices across specific parameters",
          "It refers strictly to a company's legal compliance policies",
          "It is an unmeasurable, purely qualitative philosophical approach",
        ],
        "b",
        "esg-vs-csr"
      ),
      q(
        "How is Sustainability explicitly defined by the speaker?",
        [
          "Meeting the needs of the present without compromising the ability of future generations to meet their own needs",
          "Maximizing short-term quarterly profits for immediate stakeholder distribution",
          "Eliminating all interactions with corporate stakeholders to avoid environmental conflicts",
          "A management framework meant exclusively for social governance metrics",
        ],
        "a",
        "esg-vs-csr"
      ),
      q(
        "Which concept is described as the management aspect where companies integrate social and environmental concerns directly into their daily operations by interacting with stakeholders?",
        ["Environmental Parameters", "Quantifiable Metrics", "Corporate Social Responsibility (CSR)", "Generational Equality"],
        "c",
        "esg-vs-csr"
      ),
      q(
        'What is described as the "larger picture" that encompasses concepts like Net Zero, Circular Economy, and Business Ethics?',
        ["Corporate Social Responsibility (CSR)", "Environment Social Governance (ESG)", "Sustainability", "Global Reporting Initiative (GRI)"],
        "c",
        "esg-vs-csr"
      ),
      q(
        "Which of the following is characterized as a quantifiable assessment framework used to measure sustainability aspects, often associated with frameworks like SASB and TCFD?",
        ["Sustainability", "ESG", "Philanthropic contributions", "CSR"],
        "b",
        "esg-vs-csr"
      ),
      q(
        "The Companies Act 2013 in India provides a mandate specifically for which of the following areas?",
        ["CSR (Corporate Social Responsibility)", "Net Zero commitments", "Carbon Disclosure Project (CDP)", "Employee wellbeing programs"],
        "a",
        "esg-vs-csr"
      ),
      q(
        "What are the specific target years set by the mining company (case study) for achieving its net zero carbon emissions and net water positivity goals?",
        [
          "Net zero carbon by 2030; net water positivity by 2050",
          "Net zero carbon by 2050; net water positivity by 2030",
          "Net zero carbon by 2040; net water positivity by 2035",
          "Net zero carbon by 2045; net water positivity by 2040",
        ],
        "b",
        "case-study"
      ),
      q(
        "Which framework or platform is specified in the case study for assessing and reporting the ESG performance of the company's supply chain?",
        ["BRSR (Business Responsibility and Sustainability Report)", "GRI (Global Reporting Initiative)", "EcoVadis", "ClarityAI"],
        "c",
        "case-study"
      ),
      q(
        "In addition to addressing children's education and malnutrition at mining sites, which of the following is an explicit CSR activity for the company in the case study?",
        [
          "Setting up shelters, hospitals, and skill development centers for animal care",
          "Financing urban micro-mobility and electric vehicle public infrastructure",
          "Developing carbon offset programs exclusively through commercial forestry",
          "Launching digital literacy campaigns for secondary schools in metropolitan cities",
        ],
        "a",
        "case-study"
      ),
      q(
        "Which of the following is specifically categorized as an Environmental factor within the ESG framework?",
        ["Avoiding conflicts of interest", "Equal employment opportunity", "Water usage and management", "Accounting integrity and transparency"],
        "c",
        "environmental"
      ),
      q(
        "What is the primary purpose of evaluating ESG factors?",
        [
          "To maximize short-term profit margins for shareholders",
          'To determine if organizations are being "good corporate citizens"',
          "To replace traditional financial accounting systems entirely",
          "To completely eliminate all energy consumption across operations",
        ],
        "b",
        "environmental"
      ),
      q(
        'When explaining the "Environmental" pillar, what specific examples of energy usage does the speaker highlight?',
        [
          "The number of hours employees spend working on-site",
          "How much fuel and electricity the organization consumes",
          "The financial cost of upgrading office hardware",
          "The carbon offset credits purchased from third parties",
        ],
        "b",
        "environmental"
      ),
      q(
        "Which of the following is specifically evaluated as part of the corporate governance structure under the Governance (G) pillar?",
        [
          "The implementation of workplace health and safety protocols across supply chains",
          "The optimization of energy efficiency and reduction of greenhouse gas emissions",
          "The composition, gender ratio, and training level of the Board of Directors",
          "The metrics surrounding fair pay, living wages, and equal employment opportunities",
        ],
        "c",
        "governance"
      ),
      q(
        'Under the Governance pillar, why is tracking "related party transactions" and conflicts of interest emphasized?',
        [
          "To guarantee the company's compliance with local biodiversity and wildlife regulations",
          "To maintain accounting integrity, ensure financial transparency, and safeguard management mechanisms",
          "To improve public relations and expand market reach into international consumer bases",
          "To restructure the entire business into a community-owned, non-profit organization",
        ],
        "b",
        "governance"
      ),
      q(
        "The overarching goal of analyzing all three ESG factors is to determine whether an organization is:",
        [
          "Operating at the lowest possible cost of labor in its specific sector",
          'Being a "good corporate citizen" regarding its impacts and management',
          "Eliminating the need for internal committees like audit or risk committees",
          "Prioritizing short-term shareholder profits over all regulatory compliances",
        ],
        "b",
        "governance"
      ),
    ],
  },
  {
    folder: "Evolution of ESG",
    slug: "evolution-of-esg",
    title: "Evolution of ESG",
    description: "From the Brundtland Commission to SFDR — the milestones that made ESG mandatory.",
    questions: [
      q(
        'How did the Brundtland Commission define "sustainable development" in 1987?',
        [
          "Development that focuses exclusively on immediate financial and environmental returns",
          "Development that meets the needs of the present without compromising the ability of future generations to meet their own needs",
          "Development aimed at standardizing global financial reporting protocols",
          "Development that requires developing nations to halt carbon emissions by 2050",
        ],
        "b",
        "history"
      ),
      q(
        "Which of the following was launched in 1990 and is noted in the timeline as the first ESG index fund?",
        ["Carbon Disclosure Project (CDP)", "UN Principles of Responsible Investment", "Domini Social Index", "Sustainability Standards Accounting Board (SASB)"],
        "c",
        "history"
      ),
      q(
        "In what year were the UN Sustainable Development Goals (SDGs) launched and the Paris Agreement signed by 197 countries?",
        ["2000", "2006", "2011", "2015"],
        "d",
        "history"
      ),
      q("In what year was the world's first ESG index fund, the Domini Social Index, created?", ["1987", "1990", "2000", "2006"], "b", "index-funds"),
      q(
        "What is the Domini Social Index currently renamed as?",
        ["MSCI LD 400 SI", "Carbon Disclosure Project (CDP)", "UN SDGs", "Sustainability Standards Accounting Board (SASB)"],
        "a",
        "index-funds"
      ),
      q(
        "What was the primary purpose of launching the Domini Social Index?",
        [
          "To unify countries around sustainable development",
          "To protest apartheid and divest multi-billion dollars",
          "To help socially conscious investors weigh social and environmental factors in their investment choices",
          "To create global reporting initiatives",
        ],
        "c",
        "index-funds"
      ),
      q(
        "In 1993, what major historical event prompted a multi-billion dollar protest divestment campaign by US college funds and other institutional investors?",
        [
          "The escalation of the Vietnam War contracts",
          "The South African Apartheid regime",
          "The environmental fallout from the Gulf War oil spills",
          "The initial draft of the Kyoto Protocol negotiations",
        ],
        "b",
        "capital-activism"
      ),
      q(
        "Which UK-based non-profit organization was created in 2000 with the core objective of turning environmental risk management and disclosure into a standard business norm?",
        [
          "Global Reporting Initiative (GRI)",
          "Sustainability Accounting Standards Board (SASB)",
          "Carbon Disclosure Project (CDP)",
          "Task Force on Climate-related Financial Disclosures (TCFD)",
        ],
        "c",
        "capital-activism"
      ),
      q(
        "Which milestone laid the foundational framework in 1987 by defining 'sustainability' to align global development efforts?",
        [
          "The Brundtland Commission's definition of sustainable development",
          "The launch of the Domini Social Index (MSCI LDI 400 SI)",
          "The ratification of the Paris Agreement by 197 countries",
          "The official creation of the United Nations Sustainable Development Goals (SDGs)",
        ],
        "a",
        "capital-activism"
      ),
      q(
        "What significant event in the evolution of ESG occurred in 2006?",
        [
          "Carbon Disclosure Project (CDP) was created",
          "UN Principles of Responsible Investment (UN PRI) was launched",
          "Paris Agreement was signed",
          "Sustainability Standards Accounting Board (SASB) was founded",
        ],
        "b",
        "un-pri"
      ),
      q(
        "How much in Assets Under Management (AUM) did the UN Principles for Responsible Investment launch with?",
        ["$4 billion", "$4 trillion", "$14 trillion", "$40 trillion"],
        "b",
        "un-pri"
      ),
      q("How many essential principles did the UN PRI follow to ensure responsible investments by financial institutions?", ["Four", "Five", "Six", "Ten"], "c", "un-pri"),
      q(
        "In which year was the Sustainability Accounting Standards Board (SASB) founded?",
        ["1993", "2000", "2011", "2015"],
        "c",
        "sasb"
      ),
      q(
        "The development of SASB's disclosure framework was explicitly driven by extensive feedback from which core groups?",
        [
          "Academic researchers and environmental NGOs exclusively",
          "Companies, investors, and other financial market participants",
          "National government ministries and global trade unions",
          "Retail consumers and local community organizers",
        ],
        "b",
        "sasb"
      ),
      q(
        "What is the primary objective of the accounting standards disseminated by SASB for public corporations?",
        [
          "To completely replace traditional balance sheets and GAAP financial accounting frameworks",
          "To levy regulatory penalties and compliance fines on high-emission corporations",
          "To enable the disclosure of material and decision-useful sustainability information to investors",
          "To provide proprietary marketing tools for corporate public relations campaigns",
        ],
        "c",
        "sasb"
      ),
      q(
        "Why is the year 2015 considered a 'marquee' or 'landmark' year in ESG history?",
        [
          "The implementation of the European Union Sustainable Finance Disclosure Regulation",
          "The formal conceptualization of sustainable development by the Brundtland Commission",
          "The concurrent launch of UN SDGs, signing of the Paris Agreement, and initiation of TCFD",
          "The establishment of the Carbon Disclosure Project and Global Reporting Initiative",
        ],
        "c",
        "2015"
      ),
      q(
        "Under the Paris Agreement signed by 197 countries in 2015, what specific target was set to limit the rise in the Earth's surface temperature?",
        ["2.0°C", "3.0°C", "2.5°C", "1.5°C"],
        "d",
        "2015"
      ),
      q(
        "Which two countries have transitioned the voluntary TCFD framework into a mandatory financial disclosure regime?",
        ["Germany and France", "Australia and Japan", "United Kingdom and New Zealand", "United States and Canada"],
        "c",
        "2015"
      ),
      q(
        "What landmark global climate treaty and international framework were launched alongside the TCFD in the pivotal year of 2015?",
        [
          "The Brundtland Commission and the Domini Social Index",
          "The UN Sustainable Development Goals (SDGs) and the Paris Agreement",
          "The UN Principles for Responsible Investment (PRI) and the EU Taxonomy",
          "The Global Reporting Initiative (GRI) and the SFDR",
        ],
        "b",
        "mandatory-era"
      ),
      q(
        "The 1993 protest divestment demonstrated the power of collective financial activism by divesting billions of dollars in protest of:",
        ["Fossil fuel reliance", "Deforestation in the Amazon", "Apartheid", "Modern corporate labor practices"],
        "c",
        "mandatory-era"
      ),
      q(
        "Which regulation came into effect in 2021, moving the European Union into an era of mandatory ESG disclosures for financial markets?",
        [
          "SASB (Sustainability Accounting Standards Board)",
          "TCFD (Task Force on Climate-Related Financial Disclosures)",
          "CDP (Carbon Disclosure Project)",
          "SFDR (Sustainable Finance Disclosure Regulation)",
        ],
        "d",
        "mandatory-era"
      ),
    ],
  },
  {
    folder: "Indian ESG Landscape",
    slug: "indian-esg-landscape",
    title: "Indian ESG Landscape",
    description: "From the 2011 National Voluntary Guidelines to BRSR Core — how India's ESG mandate scaled from 100 to 1,000 companies.",
    questions: [
      q(
        "What was the first key milestone established in 2011 to help businesses align with social, environmental, and economic responsibilities?",
        [
          "Business Responsibility Report (BRR)",
          "National Voluntary Guidelines (NVGs)",
          "National Guidelines for Responsible Business Conduct (NGRBC)",
          "Business Responsibility and Sustainability Report (BRSR)",
        ],
        "b",
        "india-timeline"
      ),
      q(
        "When the Business Responsibility Report (BRR) was first launched in 2012, which companies were required to adopt it?",
        ["The top 100 listed businesses", "The top 500 listed businesses", "The top 1,000 listed businesses", "All listed companies in India"],
        "a",
        "india-timeline"
      ),
      q(
        "Which reporting format was proposed by the Ministry of Corporate Affairs (MCA) committee in 2020, leading to its release for the top 1,000 listed companies in 2021?",
        [
          "Corporate Social Responsibility Report (CSRR)",
          "Sustainable Finance Disclosure Regulations (SFDR)",
          "Business Responsibility and Sustainability Report (BRSR)",
          "National Voluntary Guidelines (NVGs)",
        ],
        "c",
        "india-timeline"
      ),
      q(
        "In what year did the Ministry of Corporate Affairs (MCA) introduce the National Guidelines for Responsible Business Conduct (NGRBC)?",
        ["2011", "2015", "2018", "2020"],
        "c",
        "india-timeline"
      ),
      q(
        "When was the Business Responsibility Report (BRR) extended to encompass the top 1,000 listed businesses?",
        ["2012", "2015", "2019", "2021"],
        "c",
        "india-timeline"
      ),
      q(
        "What major milestone in the Indian ESG landscape took place in 2023 to enhance supply chain transparency and data reliability?",
        [
          "Release of the initial BRSR framework for top listed companies",
          "Development of BRSR Core for reasonable assurance and supplier coverage",
          "Extension of BRR requirements to the top 500 businesses",
          "First introduction of National Voluntary Guidelines (NVGs)",
        ],
        "b",
        "brsr-core"
      ),
      q(
        "According to the SEBI staggered compliance approach, when was the BRSR officially released for the top 1,000 listed companies?",
        ["2012", "2019", "2021", "2023"],
        "c",
        "brsr-core"
      ),
      q(
        "What was the primary focus of the major update made to the Indian ESG reporting framework in 2023?",
        [
          "Initial launch of the National Voluntary Guidelines (NVGs)",
          "Expanding the basic BRR format to the top 500 companies",
          "Development of BRSR Core for reasonable assurance and supplier coverage",
          "Formalizing the initial format of the BRSR under an MCA committee",
        ],
        "c",
        "brsr-core"
      ),
      q(
        "What is a key focus of the 2023 developments for BRSR Core reporting?",
        [
          "Making all reporting voluntary",
          "Extending coverage to include the company's supply chain",
          "Reducing the number of reporting companies to 500",
          "Replacing BRSR with GRI standards",
        ],
        "b",
        "brsr-core"
      ),
      q(
        "How does BRSR differ from GRI for the top 1,000 listed companies in India?",
        ["BRSR is voluntary, while GRI is mandatory", "BRSR is mandatory, while GRI is voluntary", "Both are mandatory", "Both are voluntary"],
        "b",
        "brsr-vs-gri"
      ),
    ],
  },
  {
    folder: "ESG for Organizations",
    slug: "esg-for-organizations",
    title: "ESG for Organizations",
    description: "The four drivers pushing organizations to adopt ESG: systemic risk, investor pressure, consumer expectations, and regulation.",
    questions: [
      q(
        'How does robust ESG reporting primarily safeguard an organization against "systemic risks"?',
        [
          "By providing absolute immunity from domestic regulatory audits",
          "By enabling companies to identify, evaluate, and mitigate physical risks to ensure long-term operational resilience",
          "By instantly eliminating regional market competition and stabilizing pricing power",
          "By removing reliance on physical supply chain logistics through total digitization",
        ],
        "b",
        "systemic-risk"
      ),
      q(
        "What is the primary rationale for institutional investors increasingly incorporating ESG frameworks into global fund allocations?",
        [
          "They assume high-scoring ESG firms are automatically exempt from corporate tax liabilities",
          "They utilize ESG metrics exclusively to minimize short-term marketing budgets",
          "They recognize that explicit ESG integration yields superior long-term returns and stronger resilience against systemic disruptions",
          "They aim to force corporations to pivot away from global market expansions",
        ],
        "c",
        "investor-pressure"
      ),
      q(
        "Which real-world disruption was explicitly highlighted to demonstrate how rapidly global supply chains can experience complete operational shutdowns?",
        ["The COVID-19 pandemic", "The 2008 financial housing crisis", "The historical 1970s OPEC energy embargo", "The early 2000s dot-com bubble burst"],
        "a",
        "systemic-risk"
      ),
      q(
        "Why are investors increasingly pressuring companies to provide ESG data points?",
        [
          "To reduce the company's overall tax burden",
          "To evaluate systemic risks and assure resilience against sudden disruptions",
          "To minimize the number of employees required for operations",
          "To guarantee immediate short-term financial returns",
        ],
        "b",
        "investor-pressure"
      ),
      q(
        'What is a well-established benefit of companies taking care of their ESG metrics, despite some debate over "better returns"?',
        [
          "Guaranteed elimination of all systemic risks",
          "Complete exemption from future regulatory action",
          "Unlocking new international supply chains",
          "Resilience against disruptions and sudden changes",
        ],
        "d",
        "investor-pressure"
      ),
      q(
        "Approximately what value of professionally managed assets is estimated to have ESG mandates or factors incorporated into their fund allocation?",
        ["Over $35 trillion", "Under $1 billion", "Exactly $10 million", "$500 billion"],
        "a",
        "investor-pressure"
      ),
      q(
        "Which regulatory body is explicitly highlighted as having mandated the BRSR guidelines in India?",
        [
          "Securities and Exchange Commission (SEC)",
          "Task Force on Climate-related Financial Disclosures (TCFD)",
          "Securities and Exchange Board of India (SEBI)",
          "Ministry of Corporate Affairs (MCA)",
        ],
        "c",
        "regulation"
      ),
      q(
        "In a highly globalized economy, why does a single localized ESG regulatory action possess the leverage to profoundly impact an entire multinational organization's operations?",
        [
          "Sovereign states automatically inherit and enforce the domestic carbon accounting policies of their largest trade partners",
          "Global supply chains are deeply interdependent, meaning a single product sold in one market is routinely procured, manufactured, and packaged across multiple different nations",
          "International trade courts systematically ban consumer goods unless every nation in the value chain utilizes identical ESG metrics",
          "Institutional funds mandate immediate disinvestment from organizations that operate across more than two distinct regulatory jurisdictions",
        ],
        "b",
        "regulation"
      ),
      q(
        "Four fundamental pillars drive organizations to adopt robust ESG frameworks. Which option represents an action that runs entirely counter to those core drivers?",
        [
          "Mitigating systemic climate and natural risks to preserve the continuous performance of supply chains",
          "Addressing investor pressure by embedding ESG into fund allocations to ensure long-term resilience against disruptions",
          "Minimizing compliance overhead by entirely removing internal reporting teams and sustainability frameworks",
          "Capitalizing on changing consumer expectations and employee engagement to unlock untapped market opportunities",
        ],
        "c",
        "regulation"
      ),
      q(
        "How are changing consumer expectations impacting organizations?",
        [
          "Consumers are demanding lower quality products",
          "Consumers are ignoring the social impact of their purchases",
          "ESG commitments are driving consumer purchases and unlocking new market opportunities",
          "Consumers prefer organizations that avoid environmental management",
        ],
        "c",
        "consumer-trends"
      ),
      q(
        "What role does regulatory action play in the importance of ESG for organizations?",
        [
          "Regulators are decreasing their scrutiny of global supply chains",
          "ESG disclosure requirements are becoming entirely voluntary globally",
          "There is heightened scrutiny, and compliance across global supply chains is slowly becoming mandatory",
          "Regulators are banning ESG practices to ensure fair competition",
        ],
        "c",
        "consumer-trends"
      ),
    ],
  },
  {
    folder: "ESG Reporting Journey",
    slug: "esg-reporting-journey",
    title: "ESG Reporting Journey",
    description: "The end-to-end journey of producing an ESG report, from scoping to disclosure.",
    questions: [], // no questions in the Assessment doc yet — no gate seeded
  },
  {
    folder: "Challenges of ESG Reporting Journey",
    slug: "esg-reporting-challenges",
    title: "Challenges of ESG Reporting",
    description: "Data nightmares, compliance jungles, corporate silos — the real-world obstacles to good ESG reporting.",
    questions: [], // no questions in the Assessment doc yet — no gate seeded
  },
  {
    folder: "BRSR Reporting",
    slug: "brsr-reporting",
    title: "BRSR Reporting",
    description: "SEBI's BRSR framework end to end: Sections A, B and C, all nine NGRBC principles, and the assurance timeline.",
    questions: [
      q(
        "Which regulatory authority designed the BRSR framework, and what is its main objective?",
        [
          "Reserve Bank of India (RBI); to streamline digital banking compliance",
          "Securities and Exchange Board of India (SEBI); to improve compliance and communication around non-financial (ESG) disclosures",
          "Ministry of Corporate Affairs (MCA); to oversee corporate taxation frameworks",
          "Bombay Stock Exchange (BSE); to audit daily equity trading volumes",
        ],
        "b",
        "brsr-basics"
      ),
      q(
        "The BRSR framework contains approximately 140 indicators. How are these KPIs categorized in terms of reporting obligation?",
        [
          "Qualitative indicators are mandatory, while quantitative indicators are voluntary",
          "Financial KPIs are mandatory, while non-financial KPIs are voluntary",
          "Essential KPIs are mandatory (comply or explain), while Leadership KPIs are voluntary",
          "Internal KPIs are mandatory, while value chain KPIs are voluntary",
        ],
        "c",
        "brsr-basics"
      ),
      q(
        "Based on the BRSR mandate table, what is the scope of compliance required for the financial year 2025-26?",
        [
          "Top 150 companies by market capitalization",
          "Top 250 companies by market capitalization",
          "Top 500 companies by market capitalization",
          "Top 1,000 companies by market capitalization",
        ],
        "c",
        "brsr-timeline"
      ),
      q(
        "Which regulatory authority designed the BRSR framework, and what primary mechanism does it utilize for non-financial disclosures?",
        [
          "RBI; utilizing a strict penal compliance framework",
          'SEBI; utilizing a "comply or explain" mechanism',
          "Ministry of Corporate Affairs (MCA); utilizing a completely voluntary filing structure",
          "NITI Aayog; utilizing a core financial auditing system",
        ],
        "b",
        "brsr-basics"
      ),
      q(
        "By which financial year must the top 1,000 listed companies by market capitalization fully respond to the BRSR framework guidelines?",
        ["FY 2023-24", "FY 2024-25", "FY 2025-26", "FY 2026-27"],
        "d",
        "brsr-timeline"
      ),
      q(
        "Starting from FY 2023-24, 'reasonable assurance' is expected to be obtained on how many identified 'core' indicators within the framework?",
        ["140 indicators", "100 indicators", "40 indicators", "250 indicators"],
        "c",
        "brsr-timeline"
      ),
      q(
        "From FY 2024-25, the top 250 listed companies must extend their BRSR Core reporting to their value chain partners. What threshold of value chain partners is targeted for disclosure?",
        [
          "The top 50% of value chain partners by market capitalization",
          "The top 75% of value chain partners by financial value or volume of goods/services",
          "All value chain partners (100% coverage) regardless of scale",
          "Only international value chain partners operating outside of India",
        ],
        "b",
        "value-chain"
      ),
      q(
        "What is the correct sequence for the number of companies required to seek assurance over successive financial years?",
        [
          "FY 2023-24: Top 150; FY 2024-25: Top 250; FY 2025-26: Top 500; FY 2026-27: Top 1,000",
          "FY 2023-24: Top 100; FY 2024-25: Top 500; FY 2025-26: Top 1,000; FY 2026-27: All listed firms",
          "FY 2022-23: Top 250; FY 2023-24: Top 500; FY 2024-25: Top 750; FY 2025-26: Top 1,000",
          "FY 2024-25: Top 150; FY 2025-26: Top 300; FY 2026-27: Top 600; FY 2027-28: Top 1,200",
        ],
        "a",
        "brsr-timeline"
      ),
      q(
        "How are BRSR indicators structured, and what level of assurance is mandated for 'core' indicators starting from FY 2023-24?",
        [
          "There are ~140 indicators that are entirely voluntary under a 'comply or explain' mechanism, with no formal assurance required",
          "The indicators consist of mandatory Leadership KPIs and voluntary Essential KPIs, requiring limited assurance",
          "The framework contains ~140 qualitative and quantitative indicators, featuring mandatory 'Essential' KPIs and voluntary 'Leadership' KPIs, with 'reasonable assurance' required for core indicators",
          "All ~140 indicators require absolute precision audit from FY 2022-23 with zero allowance for explanation",
        ],
        "c",
        "brsr-basics"
      ),
      q(
        "What is the primary focus of Section A of the BRSR?",
        [
          "Principle-specific performance disclosure metrics",
          "Policy development and corporate management processes",
          "General disclosures including company profile, operational spread, and CSR statistics",
          "Board-level governance and leadership oversight",
        ],
        "c",
        "section-a"
      ),
      q(
        "Under which Indian legislation is the CSR mandate enforced, as referenced in Section A's general disclosures?",
        [
          "The Sustainability and Green Energy Act 2015",
          "The Companies Act, 2013",
          "The Environmental Protection Act, 1986",
          "The Corporate Governance and Accountability Act 2010",
        ],
        "b",
        "section-a"
      ),
      q(
        "According to Section C of the BRSR, how many NGRBC principles form the framework for reporting performance indicators?",
        ["5 principles", "7 principles", "9 principles", "12 principles"],
        "c",
        "section-c"
      ),
      q(
        "What is the primary nature of the disclosures required in BRSR Section B?",
        ["Primarily financial", "Primarily quantitative", "Primarily mathematical", "Primarily qualitative"],
        "d",
        "section-b"
      ),
      q(
        "Which specific element is disclosed under Section B (Management and Process Disclosures) rather than Section A or C?",
        [
          "Workforce demographic statistics",
          "Corporate social responsibility expenditures",
          "NGRBC review details",
          "Principle-wise performance indicators",
        ],
        "c",
        "section-b"
      ),
      q(
        "What is a core focus of the Governance, Leadership & Oversight element within Section B?",
        [
          "Annual frequency of general board meetings",
          "Board-level supervision of sustainability policies",
          "Total compensation figures of executive directors",
          "Gender diversity ratios across board members",
        ],
        "b",
        "section-b"
      ),
      q(
        'Why is Section C characterized as the "crux" or majority of the BRSR document?',
        [
          "It details the company's financial allocations and CSR spend statistics",
          "It contains the principle-specific performance indicators assessing actual operational conduct against sustainability benchmarks",
          "It lists the baseline holding patterns, joint ventures, and subsidiary transparency disclosures",
          "It outlines the core internal governance, policy review details, and oversight structures",
        ],
        "b",
        "section-c"
      ),
      q(
        "What is the approximate density of indicators (essential + leadership) required for reporting under each individual NGRBC principle?",
        [
          "3 to 5 indicators per principle",
          "10 to 12 indicators per principle",
          "20 to 25 indicators per principle",
          "A variable scale depending entirely on corporate sector classification",
        ],
        "b",
        "section-c"
      ),
      q(
        "A corporation discloses its concentration of purchases and sales to identify potential dependencies and related party transactions. Under which BRSR principle is this disclosure primarily categorized?",
        ["Principle 9", "Principle 5", "Principle 2", "Principle 1"],
        "d",
        "principle-1"
      ),
      q(
        "Which specific indicator would involve reporting on the comprehensive environmental impact of a product throughout its entire journey, from raw material to disposal?",
        ["LCA", "EPR", "Waste reclamation", "Sustainable sourcing"],
        "a",
        "principle-2"
      ),
      q(
        "If a company incurs fines or disciplinary actions against its board of directors for unethical behavior, which section of Principle 1 would capture this information?",
        ["Examples", "Indicators", "RPTs", "Sustainable sourcing"],
        "a",
        "principle-1"
      ),
      q(
        "What is the primary focus of the second principle in the BRSR structure?",
        [
          "Conducting business with integrity and accountability",
          "Providing goods and services in a sustainable and safe manner",
          "Implementing anti-bribery policies and avoiding conflicts of interest",
          "Conducting training and awareness programs on NGRBC principles",
        ],
        "b",
        "principle-2"
      ),
      q(
        "Which of the following is mentioned as an indicator for providing goods and services sustainably and safely?",
        [
          "Number of settlements and imprisonments",
          "Concentration of purchases and sales",
          "Extended Producer Responsibility (EPR) and Life Cycle Analysis (LCA)",
          "Regulatory actions and fines",
        ],
        "c",
        "principle-2"
      ),
      q(
        "What is provided as an example of a quantitative indicator for measuring the improvement of product and process impacts?",
        [
          "Capex and R&D expenditure on technologies",
          "The number of anti-corruption policies drafted",
          "Procedures established for sustainable sourcing",
          "The total amount of plastic produced",
        ],
        "a",
        "principle-2"
      ),
      q(
        "Under BRSR Principle 3, which indicator specifically addresses the inclusion and accessibility for differently-abled employees?",
        ["PWD inclusion", "ESI coverage", "LTIFR metrics", "CSR initiatives"],
        "a",
        "principle-3"
      ),
      q(
        "What does the acronym LTIFR stand for within the context of reporting employee well-being and safety?",
        ["Long Term Insurance Failure Rate", "Labor Trust In Financial Reports", "Leading Trade In Factory Regulation", "Lost Time Injury Frequency Rate"],
        "d",
        "principle-3"
      ),
      q(
        "When evaluating 'return to work and retention rates' under Principle 3, which specific scenario is typically being monitored?",
        [
          "Employees returning from parental leave",
          "Employees retiring from the company",
          "New hires completing their probation",
          "Contract workers becoming permanent employees",
        ],
        "a",
        "principle-3"
      ),
      q(
        "Which of the following is specifically categorized as an example under Principle 4 (Stakeholder Responsiveness)?",
        ["Stakeholder consultation", "Workspace accessibility", "Association membership", "Insurance coverage"],
        "a",
        "principle-4"
      ),
      q(
        "Under Principle 3, which indicator specifically tracks the diversity and inclusion efforts of a business regarding its workforce?",
        [
          "Consultation on environmental topics",
          "Inclusion of persons with disabilities",
          "Training on human rights policies",
          "Identification of stakeholder groups",
        ],
        "b",
        "principle-3"
      ),
      q(
        "What specific focus does the BRSR framework emphasize when measuring communication frequency and channels under Principle 4?",
        ["Permanent employees and unions", "Institutional and retail investors", "Primary suppliers and vendors", "Vulnerable and marginalized groups"],
        "d",
        "principle-4"
      ),
      q(
        "Which of the following is specifically categorized under Principle 6 (Environment) of the BRSR structure?",
        ["Workplace discrimination complaints", "Trainings on human rights policies", "Operations in ecologically sensitive areas", "Wage structure assessments"],
        "c",
        "principle-6"
      ),
      q(
        "Under the BRSR framework, which indicator covers the reporting of Scope 1, Scope 2, and Scope 3 emissions?",
        ["Water and effluents", "Waste management", "Energy consumption", "Air and GHG emissions"],
        "d",
        "principle-6"
      ),
      q(
        "Regarding Principle 5 (Human Rights), which specific wage-related metric is mentioned as an example for evaluation?",
        ["Tax deductions", "Median wage", "Bonus percentages", "Overtime rates"],
        "b",
        "principle-5"
      ),
      q(
        "Which of the following is categorized as an indicator specifically under the eco-centric Principle 6?",
        [
          "Trainings on human rights policies and facility assessments",
          "Wage structures comparing median and minimum wages",
          "Air and GHG emissions, water, effluents, and energy consumption",
          "Mitigation frameworks for workplace harassment and discrimination",
        ],
        "c",
        "principle-6"
      ),
      q(
        "When tracking energy consumption under Principle 6 guidelines, what specific breakdown must an organization provide to demonstrate its environmental responsibility?",
        [
          "The ratio of domestic versus international utility providers",
          "The percentage of energy consumed from renewable fuel and electricity sources",
          "The gross financial savings realized from energy efficiency modifications",
          "The total horsepower rating of all factory machinery in operation",
        ],
        "b",
        "principle-6"
      ),
      q(
        'Under the "Waste and Emissions" cluster of Principle 6, how does the BRSR framework require corporations to disclose their climate change impacts?',
        [
          "By listing international environmental treaties signed by executive leadership",
          "By detailing point-source particulate matter sizes (PM2.5 vs PM10) exclusively",
          "By auditing operations in ecologically sensitive areas and reporting Scope 1, Scope 2, and Scope 3 emissions",
          "By calculating the gross weight of landfill garbage removed per fiscal quarter",
        ],
        "c",
        "principle-6"
      ),
      q(
        "Under which core principle are Scope 1, Scope 2, and Scope 3 emissions classified and reported?",
        [
          "Principle 5: Respect and promote human rights",
          "Principle 6: Respect, protect, and make efforts to restore the environment",
          "Principle 3: Promote the well-being of all employees",
          "Principle 7: Responsible policy advocacy",
        ],
        "b",
        "emissions"
      ),
      q(
        "Which of the following scenarios would be classified as a Scope 1 emission for an organization?",
        [
          "Emissions from electricity purchased from a third-party grid to light up the office headquarters",
          "Emissions generated by a supplier when manufacturing raw materials for the company",
          "Emissions released from burning diesel or kerosene on-site to run the organization's backup generators",
          "Emissions resulting from employees commuting via public transit or personal vehicles",
        ],
        "c",
        "emissions"
      ),
      q(
        "Which of the following examples or indicators is correctly mapped to Principle 5 (Respect and promote human rights) within the BRSR structure?",
        [
          "Monitoring operations located in ecologically sensitive areas",
          "Reviewing wage structure equity (minimum, median, above minimum) and addressing workplace discrimination",
          "Quantifying total waste generated, recovered, and disposed of by type",
          "Assessing renewable fuel and electricity consumption metrics",
        ],
        "b",
        "principle-5"
      ),
    ],
  },
  {
    folder: "ESG Careers",
    slug: "esg-careers",
    title: "ESG Careers",
    description: "Degrees, certifications, niche skills, and who is actually hiring for sustainability roles.",
    questions: [], // no questions in the Assessment doc yet — no gate seeded
  },
];
