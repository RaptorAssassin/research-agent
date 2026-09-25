import { z } from 'zod'

export const ReportSchema = z.object({
  executiveSummary: z
    .string()
    .min(1)
    .describe(
      'Main answer. Model decides length: 1 short paragraph for trivial facts, multiple structured paragraphs (with blank-line separation) for complex explanations. Use as many paragraphs as needed; may be very long. Must be evidence-backed.'
    ),
  findings: z
    .array(z.string().min(1))
    .min(1)
    .describe(
      'Key findings: model decides count and length. 2-4 concise bullets for simple queries, many detailed bullets or short paragraphs for complex topics. Each item can be multi-sentence.'
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
