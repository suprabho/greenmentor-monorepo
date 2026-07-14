// Data-driven description of the questionnaire screens (Doc 2). The wizard page
// renders each entry generically, so wording/options live in one place shared
// with the engine (questions.ts is client-safe — pure data, no server imports).

import {
  Q4_LISTED,
  Q5_EXPORTS,
  Q6_LISTED_BUYER,
  Q7_MNC,
  Q8_SYSTEMS,
  Q9_SCOPE12,
  Q10_SCOPE3,
  Q11_OWNER,
  Q12_TRAINING,
  Q13_CONSULTANTS,
  Q14_SUPPLIER_DATA,
  Q15_POLICY,
  Q16_BOARD,
  Q17_OUTPUTS,
  Q18_REQUESTS,
  SECTORS,
  TURNOVER_BANDS,
  type Option,
} from "./questions";
import type { Answers } from "./types";

export type QuestionKind = "dropdown" | "single" | "multi" | "subsector";

export interface QuestionSpec {
  id: keyof Answers;
  section: 1 | 2;
  title: string;
  help?: string;
  kind: QuestionKind;
  options?: Option[];
}

// TURNOVER_BANDS carries an extra lowerCr field; expose just {code,label} here.
const turnoverOptions: Option[] = TURNOVER_BANDS.map((b) => ({ code: b.code, label: b.label }));

export const QUESTIONS: QuestionSpec[] = [
  { id: "q1_sector", section: 1, title: "What is your primary sector?", kind: "dropdown", options: SECTORS },
  { id: "q2_subsector", section: 1, title: "What is your sub-sector?", kind: "subsector" },
  { id: "q3_turnover", section: 1, title: "What is your annual turnover (most recent FY)?", kind: "single", options: turnoverOptions },
  {
    id: "q4_listed",
    section: 1,
    title: "Is your company listed on Indian stock exchanges (BSE/NSE)?",
    help: "Not sure? Check at bseindia.com or nseindia.com by searching your company name. If your company is a subsidiary of a listed parent but not separately listed, choose 'No, unlisted'.",
    kind: "single",
    options: Q4_LISTED,
  },
  { id: "q5_exports", section: 1, title: "Do you export your products or services?", kind: "single", options: Q5_EXPORTS },
  {
    id: "q6_listed_buyer",
    section: 1,
    title: "Do you supply goods or services to large Indian listed companies?",
    help: "Major share = more than 20% of your revenue from one or more top-250 listed buyers. Minor share = less than 20%.",
    kind: "single",
    options: Q6_LISTED_BUYER,
  },
  {
    id: "q7_mnc",
    section: 1,
    title: "Do you supply goods or services to global multinational corporations (MNCs)?",
    help: "Major share = more than 20% of your revenue from one or more global MNC customers. Minor share = less than 20%.",
    kind: "single",
    options: Q7_MNC,
  },
  { id: "q8_systems", section: 2, title: "Which business systems do you currently use?", help: "Select all that apply.", kind: "multi", options: Q8_SYSTEMS },
  { id: "q9_scope12", section: 2, title: "Do you currently measure your Scope 1 and Scope 2 GHG emissions (direct fuel use + purchased electricity)?", kind: "single", options: Q9_SCOPE12 },
  { id: "q10_scope3", section: 2, title: "Have you measured Scope 3 emissions (value chain — suppliers, logistics, business travel, product use, end-of-life)?", kind: "single", options: Q10_SCOPE3 },
  { id: "q11_owner", section: 2, title: "Do you have a named ESG / sustainability owner in your organisation?", kind: "single", options: Q11_OWNER },
  { id: "q12_training", section: 2, title: "Has anyone in your organisation received formal ESG / sustainability training in the last 24 months?", kind: "single", options: Q12_TRAINING },
  { id: "q13_consultants", section: 2, title: "Are you currently working with external consultants, advisory firms, or specialist agencies on ESG / sustainability matters?", kind: "single", options: Q13_CONSULTANTS },
  { id: "q14_supplier_data", section: 2, title: "How is your supplier / vendor information managed for ESG-relevant data (emissions, certifications, code of conduct, materials of concern)?", kind: "single", options: Q14_SUPPLIER_DATA },
  { id: "q15_policy", section: 2, title: "Do you have a written ESG / sustainability policy approved by the Board?", kind: "single", options: Q15_POLICY },
  { id: "q16_board", section: 2, title: "Has your Board or senior management discussed ESG / sustainability as an agenda item in the last 12 months?", kind: "single", options: Q16_BOARD },
  { id: "q17_outputs", section: 2, title: "Have you completed any of the following in the last two years?", help: "Select all that apply.", kind: "multi", options: Q17_OUTPUTS },
  { id: "q18_requests", section: 2, title: "In the last 12 months, how many ESG data requests have you received from customers, lenders, buyers, regulators, or rating agencies?", kind: "single", options: Q18_REQUESTS },
];
