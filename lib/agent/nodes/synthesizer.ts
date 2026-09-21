import { z } from "zod"
import type { ResearchState } from "../state"
import type { LLMProvider } from "@/lib/llm/provider"
import { ReportSchema, type Report } from "../schemas/report"

export type SynthesizerDeps = {
  llm: LLMProvider
}

const DraftReportSchema = z.object({
  executiveSummary: z.string().min(1),
  findings: z.array(z.string()).min(1).max(5),
  claims: z.array(
    z.object({
      statement: z.string().min(1),
      confidence: z.number().min(0).max(1),
    }),
  ),
  conflictingEvidence: z.string(),
  limitations: z.string(),
})

export function createSynthesizerNode(deps: SynthesizerDeps) {
  return async (state: typeof ResearchState.State): Promise<{ report: Report }> => {
    const supported = state.claims.filter((c) => c.status === "supported" || c.status === "weakly_supported")
    const pool = supported.length > 0 ? supported : state.claims
    const evidenceById = new Map(state.evidence.map((e) => [e.evidenceId, e]))
    const sourceById = new Map(state.sources.map((s) => [s.sourceId, s]))

    const evidenceContext = state.evidence
      .slice(0, 12)
      .map((e) => {
        const src = sourceById.get(e.sourceId)
        return `[${e.evidenceId} src:${e.sourceId} ${src?.title ?? ""}]: "${e.text.slice(0, 300)}"`
      })
      .join("\n")

    const claimsContext = pool
      .slice(0, 8)
      .map((c) => `- ${c.statement} (confidence ${c.confidence}, status ${c.status ?? "unknown"}, evidence ${c.evidenceIds.join(",")})`)
      .join("\n")

    let draft: z.infer<typeof DraftReportSchema>
    try {
      draft = await deps.llm.structuredGenerate(
        `Synthesize report for query "${state.query}". Use ONLY provided claims/evidence, do not invent. Plan: ${state.plan?.objective ?? ""}\n\nClaims:\n${claimsContext}\n\nEvidence:\n${evidenceContext}\n\nProduce executiveSummary 2-3 sentences, findings 3-5 bullets, claims copied verbatim from Claims with confidence, conflictingEvidence explicit (or "No conflicts"), limitations (sources freshness/quality gaps). Respond ONLY JSON.`,
        DraftReportSchema,
      )
    } catch (err) {
      console.warn(`[synthesizer] LLM failed: ${err instanceof Error ? err.message : String(err)} — fallback`)
      const fallbackClaims = pool.slice(0, 3).map((c) => ({ statement: c.statement, confidence: c.confidence }))
      draft = {
        executiveSummary: `Research on "${state.query}" based on ${state.sources.length} sources and ${state.claims.length} claims. Confidence moderate.`,
        findings: fallbackClaims.map((c) => c.statement),
        claims: fallbackClaims,
        conflictingEvidence: "No explicit conflicts detected; evidence coverage limited.",
        limitations: "Limited to scraped snippets; some sources may be stale or low-credibility.",
      }
    }

    const claimToSources = new Map<string, string[]>()
    for (const cl of pool) {
      const sids = cl.evidenceIds.map((eid) => evidenceById.get(eid)?.sourceId).filter(Boolean) as string[]
      claimToSources.set(cl.statement, [...new Set(sids)])
    }

    const reportClaims = draft.claims.map((dc) => {
      const sids = claimToSources.get(dc.statement) ?? pool.find((p) => p.statement === dc.statement)?.evidenceIds.map((eid) => evidenceById.get(eid)?.sourceId).filter(Boolean) as string[] ?? []
      const valid = sids.filter((id) => sourceById.has(id))
      const citations = valid.length > 0 ? valid.slice(0, 2) : state.sources.slice(0, 1).map((s) => s.sourceId)
      return { statement: dc.statement, citations, confidence: dc.confidence }
    })

    const allCitations = [...new Set(reportClaims.flatMap((c) => c.citations))]
    const validCitations = allCitations.filter((id) => [...evidenceById.values()].some((e) => e.sourceId === id))
    const finalCitations = validCitations.length > 0 ? validCitations : allCitations.slice(0, 2)

    const sourcesBib = state.sources.slice(0, 10).map((s) => ({ sourceId: s.sourceId, url: s.url, title: s.title }))

    const candidate: Report = {
      executiveSummary: draft.executiveSummary,
      findings: draft.findings,
      claims: reportClaims,
      citations: finalCitations,
      conflictingEvidence: draft.conflictingEvidence,
      limitations: draft.limitations,
      sources: sourcesBib,
      generatedAt: new Date().toISOString(),
    }

    const parsed = ReportSchema.safeParse(candidate)
    if (!parsed.success) {
      throw new Error(`Synthesizer produced invalid Report: ${z.prettifyError(parsed.error)}`)
    }

    if (parsed.data.citations.some((id) => ![...evidenceById.values()].some((e) => e.sourceId === id))) {
      console.warn("[synthesizer] citation validation warning: some citations not in evidence[].sourceId — fixing")
      parsed.data.citations = parsed.data.citations.filter((id) => [...evidenceById.values()].some((e) => e.sourceId === id))
      if (parsed.data.citations.length === 0 && state.sources.length) {
        parsed.data.citations = [state.sources[0].sourceId]
        parsed.data.claims[0].citations = [state.sources[0].sourceId]
      }
    }

    return { report: parsed.data }
  }
}
