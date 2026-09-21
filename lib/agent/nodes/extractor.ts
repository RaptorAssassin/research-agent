import { z } from "zod"
import type { Evidence, Claim } from "../schemas/claim"
import type { ResearchState } from "../state"
import type { LLMProvider } from "@/lib/llm/provider"

export type ExtractorDeps = {
  llm: LLMProvider
}

const ExtractionSchema = z.object({
  evidence: z
    .array(
      z.object({
        text: z.string().min(10).describe("Verbatim excerpt 20-300 chars from source content"),
        location: z.string().optional().describe("Chars or section hint"),
      }),
    )
    .min(1)
    .max(4)
    .describe("Evidence excerpts per source"),
  claims: z
    .array(
      z.object({
        statement: z.string().min(10).describe("Atomic factual claim supported by that source"),
        confidence: z.number().min(0).max(1).describe("Confidence 0-1"),
      }),
    )
    .min(1)
    .max(4)
    .describe("Claims drawn from that source"),
})

export function createExtractorNode(deps: ExtractorDeps) {
  return async (state: typeof ResearchState.State): Promise<{ evidence: Evidence[]; claims: Claim[] }> => {
    if (state.sources.length === 0) return { evidence: [], claims: [] }

    const evidence: Evidence[] = []
    const claims: Claim[] = []

    const topSources = [...state.sources]
      .sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0))
      .slice(0, 6)

    for (const source of topSources) {
      const content = (source.content ?? source.snippet ?? "").slice(0, 6000)
      if (content.trim().length < 40) continue

      try {
        const out = await deps.llm.structuredGenerate(
          `You extract Evidence and Claims from a source for query "${state.query}".\nSource title: "${source.title}"\nSource URL: ${source.url}\nContent:\n"""${content}"""\n\nRules: Evidence.text must be VERBATIM substring of Content (copy exactly, 20-300 chars). location ~ chars. Claims must be atomic facts directly supported by the evidence from THIS source. confidence 0-1. Respond ONLY JSON matching schema.`,
          ExtractionSchema,
        )

        const sourceEvidenceIds: string[] = []
        for (const ev of out.evidence) {
          const eid = crypto.randomUUID()
          evidence.push({
            evidenceId: eid,
            sourceId: source.sourceId,
            text: ev.text,
            location: ev.location,
          })
          sourceEvidenceIds.push(eid)
        }

        if (sourceEvidenceIds.length === 0) continue

        for (const cl of out.claims) {
          const eids = sourceEvidenceIds.slice(0, 2)
          claims.push({
            claimId: crypto.randomUUID(),
            statement: cl.statement,
            confidence: cl.confidence,
            evidenceIds: eids,
          })
        }
      } catch (err) {
        console.warn(`[extractor] failed for ${source.url}: ${err instanceof Error ? err.message : String(err)}`)
        const snippet = (source.snippet ?? source.content ?? "").slice(0, 240)
        if (snippet.length >= 20) {
          const eid = crypto.randomUUID()
          evidence.push({ evidenceId: eid, sourceId: source.sourceId, text: snippet, location: "snippet" })
          claims.push({
            claimId: crypto.randomUUID(),
            statement: `${source.title}: ${snippet.slice(0, 120)}`,
            confidence: 0.55,
            evidenceIds: [eid],
          })
        }
      }
    }

    if (evidence.length === 0 && state.sources.length > 0) {
      const s = state.sources[0]
      const eid = crypto.randomUUID()
      const text = (s.content ?? s.snippet ?? s.title).slice(0, 300)
      evidence.push({ evidenceId: eid, sourceId: s.sourceId, text, location: "fallback" })
      claims.push({
        claimId: crypto.randomUUID(),
        statement: `Fallback claim from ${s.title}`,
        confidence: 0.4,
        evidenceIds: [eid],
      })
    }

    return { evidence, claims }
  }
}
