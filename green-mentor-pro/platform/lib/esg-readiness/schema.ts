// Zod schema for the incoming assessment answers — validated at the API
// boundary (app/api/esg-readiness/assess) before the engine runs. Option codes
// are constrained to the definitions in questions.ts so a malformed/tampered
// payload is rejected rather than silently scored as 0.

import { z } from "zod";

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

const codes = (opts: Option[]) => opts.map((o) => o.code) as [string, ...string[]];
const single = (opts: Option[]) => z.enum(codes(opts));
const multi = (opts: Option[]) => z.array(z.enum(codes(opts))).min(1);

export const answersSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  q1_sector: z.enum(SECTORS.map((s) => s.code) as [string, ...string[]]),
  q2_subsector: z.string().trim().min(1).max(200),
  q3_turnover: z.enum(TURNOVER_BANDS.map((b) => b.code) as [string, ...string[]]),
  q4_listed: single(Q4_LISTED),
  q5_exports: single(Q5_EXPORTS),
  q6_listed_buyer: single(Q6_LISTED_BUYER),
  q7_mnc: single(Q7_MNC),
  q8_systems: multi(Q8_SYSTEMS),
  q9_scope12: single(Q9_SCOPE12),
  q10_scope3: single(Q10_SCOPE3),
  q11_owner: single(Q11_OWNER),
  q12_training: single(Q12_TRAINING),
  q13_consultants: single(Q13_CONSULTANTS),
  q14_supplier_data: single(Q14_SUPPLIER_DATA),
  q15_policy: single(Q15_POLICY),
  q16_board: single(Q16_BOARD),
  q17_outputs: multi(Q17_OUTPUTS),
  q18_requests: single(Q18_REQUESTS),
});

export type AnswersInput = z.infer<typeof answersSchema>;
