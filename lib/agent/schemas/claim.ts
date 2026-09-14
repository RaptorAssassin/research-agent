import { z } from "zod";

export const SourceSchema = z.object({
  sourceId: z.uuid(),
  url: z.url(),
  title: z.string().min(1).describe("Title of the source"),
  snippet: z.string().optional().describe("Search snippet — not evidence"),
  content: z.string().optional().describe("Full scraped content"),
  publishedAt: z.string().optional().describe("ISO date for freshness signal"),
  sourceType: z.enum(["primary", "secondary"]).optional().describe("Primary vs secondary source"),
  credibility: z.number().min(0).max(1).optional().describe("Credibility score 0-1 (LLM + deterministic)"),
  relevance: z.number().min(0).max(1).optional().describe("Relevance score 0-1"),
});

export type Source = z.infer<typeof SourceSchema>;

export const EvidenceSchema = z.object({
  evidenceId: z.uuid(),
  sourceId: z.uuid().describe("References Source.sourceId"),
  text: z.string().min(1).describe("Verbatim excerpt from the source"),
  location: z.string().optional().describe("Location in source, e.g. 'p.2' or 'chars 102-340'"),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

export const FactCheckStatusSchema = z.enum([
  "supported",
  "weakly_supported",
  "unsupported",
  "conflicting",
  "unresolved",
]);

export type FactCheckStatus = z.infer<typeof FactCheckStatusSchema>;

export const ClaimSchema = z.object({
  claimId: z.uuid(),
  statement: z.string().min(1).describe("The claim statement"),
  confidence: z.number().min(0).max(1).describe("Confidence 0-1"),
  evidenceIds: z.array(z.uuid()).min(1).describe("References Evidence.evidenceId[] — must be non-empty"),
  status: FactCheckStatusSchema.optional().describe("Set by factChecker node"),
});

export type Claim = z.infer<typeof ClaimSchema>;
