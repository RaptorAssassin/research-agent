import { z } from 'zod'

export const ReportSchema = z.object({
  executiveSummary: z
    .string()
    .min(80)
    .max(1200)
    .describe(
      'Detailed 4-6 sentence answer: direct answer + context, historical/geographic significance, and confidence. Must be evidence-backed, 90-180 words.'
    ),
  findings: z
    .array(z.string().min(20).max(400))
    .min(3)
    .max(7)
    .describe(
      '5-7 detailed findings, each 1-2 sentences with concrete facts, numbers, dates, and context — not just the direct answer'
    ),
  claims: z
    .array(
      z.object({
        statement: z
          .string()
          .min(1)
          .describe('Claim statement copied from Claim.statement'),
        citations: z
          .array(z.uuid())
          .min(1)
          .describe(
            'SourceIds that support this claim — must be subset of Evidence.sourceId'
          ),
        confidence: z
          .number()
          .min(0)
          .max(1)
          .describe('Confidence for this claim'),
      })
    )
    .describe('Evidence-backed claims section'),
  citations: z
    .array(z.uuid())
    .describe(
      'Flat list of all cited sourceIds — must be subset of evidence[].sourceId'
    ),
  conflictingEvidence: z
    .string()
    .describe(
      'Summary of conflicting evidence / uncertainty — keep explicit, not collapsed'
    ),
  limitations: z
    .string()
    .describe('Limitations of sources / what is still unknown'),
  sources: z
    .array(
      z.object({
        sourceId: z.uuid().describe('SourceId from Source.sourceId'),
        url: z.url().describe('URL'),
        title: z.string().describe('Title'),
      })
    )
    .describe('Sources bibliography'),
  generatedAt: z.iso.datetime(),
})

export type Report = z.infer<typeof ReportSchema>
