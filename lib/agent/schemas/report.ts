import { z } from 'zod'

export const ReportSchema = z.object({
  executiveSummary: z
    .string()
    .min(1)
    .describe('2-3 sentence overview of answer + confidence'),
  findings: z
    .array(z.string())
    .min(1)
    .describe('3-5 key findings, each evidence-backed'),
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
