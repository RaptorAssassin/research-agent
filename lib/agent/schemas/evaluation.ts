import { z } from 'zod'

export const EvaluationSchema = z.object({
  needsMoreResearch: z
    .boolean()
    .describe('Whether the claim needs more research'),
  reasoning: z.string().min(1).describe('Reasoning behind the evaluation'),
  confidence: z.number().min(0).max(1).describe('Confidence 0-1'),
  dimensions: z
    .object({
      factuality: z.number().min(0).max(1).describe('Factuality score 0-1'),
      citationCorrectness: z
        .number()
        .min(0)
        .max(1)
        .describe('Citation correctness score 0-1'),
      sourceQuality: z
        .number()
        .min(0)
        .max(1)
        .describe('Source quality score 0-1'),
      relevance: z.number().min(0).max(1).describe('Relevance score 0-1'),
      evidenceCoverage: z
        .number()
        .min(0)
        .max(1)
        .describe('Evidence coverage score 0-1'),
    })
    .describe('Five rubric scores 0-1 for radar chart/logic'),
  missingInfo: z
    .array(z.string())
    .describe('Gaps in evidence or knowledge identified during evaluation'),
  unsupportedClaims: z
    .array(z.string())
    .describe('Claim IDs or statements that lack sufficient evidence'),
  contradictions: z
    .array(z.string())
    .describe('Detected contradictions or conflicting evidence notes'),
  followUpQuestions: z
    .array(z.string())
    .describe('Questions to guide the next research iteration'),
  iteration: z
    .number()
    .int()
    .min(0)
    .describe('Current iteration count of the research loop'),
})

export type Evaluation = z.infer<typeof EvaluationSchema>
