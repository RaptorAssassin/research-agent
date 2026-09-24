import { z } from 'zod'
import type { ResearchState } from '../state'
import type { LLMProvider } from '@/lib/llm/provider'
import { ReportSchema, type Report } from '../schemas/report'

export type SynthesizerDeps = {
  llm: LLMProvider
}

const DraftReportSchema = z.object({
  executiveSummary: z.string().min(80).max(1200),
  findings: z.array(z.string().min(20).max(400)).min(3).max(7),
  claims: z.array(
    z.object({
      statement: z.string().min(1),
      confidence: z.number().min(0).max(1),
    })
  ),
  conflictingEvidence: z.string(),
  limitations: z.string(),
})

export function createSynthesizerNode(deps: SynthesizerDeps) {
  return async (
    state: typeof ResearchState.State
  ): Promise<{ report: Report }> => {
    const supported = state.claims.filter(
      (c) => c.status === 'supported' || c.status === 'weakly_supported'
    )
    const pool = supported.length > 0 ? supported : state.claims
    const evidenceById = new Map(state.evidence.map((e) => [e.evidenceId, e]))
    const sourceById = new Map(state.sources.map((s) => [s.sourceId, s]))

    const evidenceContext = state.evidence
      .slice(0, 12)
      .map((e) => {
        const src = sourceById.get(e.sourceId)
        return `[${e.evidenceId} src:${e.sourceId} ${src?.title ?? ''}]: "${e.text.slice(0, 300)}"`
      })
      .join('\n')

    const claimsContext = pool
      .slice(0, 8)
      .map(
        (c) =>
          `- ${c.statement} (confidence ${c.confidence}, status ${c.status ?? 'unknown'}, evidence ${c.evidenceIds.join(',')})`
      )
      .join('\n')

    let draft: z.infer<typeof DraftReportSchema>
    try {
      draft = await deps.llm.structuredGenerate(
        `Synthesize a comprehensive report for query "${state.query}". Use ONLY provided claims/evidence, do not invent.
Plan objective: ${state.plan?.objective ?? ''}

Claims:
${claimsContext}

Evidence (verbatim excerpts):
${evidenceContext}

Instructions:
- executiveSummary: 4-6 sentences, 90-180 words. Start with direct answer, then add geographic/historical/political context, significance, and confidence nuance. For trivial facts (e.g. "capital of Germany") still provide context: why Berlin (history since 1990 reunification), population/district, role as seat of parliament/Bundestag, cultural significance. Do not embed source titles or URLs inline; cite via claims only.
- findings: 5-7 detailed findings. Each 1-2 sentences with specific facts, numbers, dates, names from evidence where possible. Go beyond the direct answer: include history, demographics, geography, governance, and relevance. No one-word bullets. Do not prefix findings with source titles like "Title | Site:" — write findings as standalone statements.
- claims: copy verbatim from provided Claims (statement + confidence). Do not rephrase.
- conflictingEvidence: explicit summary or "No conflicts — all sources agree" if none.
- limitations: note freshness, source quality, gaps (1-2 sentences).

Respond ONLY JSON per schema.`,
        DraftReportSchema
      )
    } catch (err) {
      console.warn(
        `[synthesizer] LLM failed: ${err instanceof Error ? err.message : String(err)} — fallback`
      )
      const fallbackClaims = pool
        .slice(0, 3)
        .map((c) => ({ statement: c.statement, confidence: c.confidence }))

      const cleanSnippet = (s: string) => {
        const lastColon = s.lastIndexOf(': ')
        let cleaned =
          lastColon > 10 && lastColon < s.length - 15
            ? s.slice(lastColon + 2).trim()
            : s
        cleaned = cleaned.replace(/\s+/g, ' ').trim()
        if (cleaned.length > 220) cleaned = cleaned.slice(0, 220).trimEnd() + '…'
        return cleaned
      }

      const firstClean = fallbackClaims[0]
        ? cleanSnippet(fallbackClaims[0].statement)
        : ''

      draft = {
        executiveSummary: firstClean
          ? `Research on "${state.query}" found ${state.sources.length} sources and ${state.claims.length} claims. ${firstClean} Confidence is moderate — evidence is snippet-only and the query was broad. Review findings and cited sources for details.`
          : `Research on "${state.query}" found ${state.sources.length} sources and ${state.claims.length} claims. Confidence is moderate — evidence is snippet-only; see findings and sources for details.`,
        findings: (() => {
          const cleaned = fallbackClaims.map((c) => {
            const s = cleanSnippet(c.statement)
            return s.length < 20 ? c.statement.slice(0, 200) : s
          })
          while (cleaned.length < 3) {
            cleaned.push(
              cleaned.length === 0
                ? `No strong claims extracted for "${state.query}" — evidence was sparse.`
                : `Additional evidence from ${state.sources.length} sources supports the summary; check citations.`
            )
          }
          return cleaned.slice(0, 5)
        })(),
        claims: fallbackClaims,
        conflictingEvidence:
          'No explicit conflicts detected; evidence coverage limited.',
        limitations:
          'LLM fallback used; limited to scraped snippets; some sources may be stale or low-credibility. Verify via cited sources.',
      }
    }

    const claimToSources = new Map<string, string[]>()
    for (const cl of pool) {
      const sids = cl.evidenceIds
        .map((eid) => evidenceById.get(eid)?.sourceId)
        .filter(Boolean) as string[]
      claimToSources.set(cl.statement, [...new Set(sids)])
    }

    const reportClaims = draft.claims.map((dc) => {
      const sids =
        claimToSources.get(dc.statement) ??
        (pool
          .find((p) => p.statement === dc.statement)
          ?.evidenceIds.map((eid) => evidenceById.get(eid)?.sourceId)
          .filter(Boolean) as string[]) ??
        []
      const valid = sids.filter((id) => sourceById.has(id))
      const citations =
        valid.length > 0
          ? valid.slice(0, 2)
          : state.sources.slice(0, 1).map((s) => s.sourceId)
      return { statement: dc.statement, citations, confidence: dc.confidence }
    })

    const allCitations = [...new Set(reportClaims.flatMap((c) => c.citations))]
    const validCitations = allCitations.filter((id) =>
      [...evidenceById.values()].some((e) => e.sourceId === id)
    )
    const finalCitations =
      validCitations.length > 0 ? validCitations : allCitations.slice(0, 2)

    const sourcesBib = state.sources
      .slice(0, 10)
      .map((s) => ({ sourceId: s.sourceId, url: s.url, title: s.title }))

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
      throw new Error(
        `Synthesizer produced invalid Report: ${z.prettifyError(parsed.error)}`
      )
    }

    if (
      parsed.data.citations.some(
        (id) => ![...evidenceById.values()].some((e) => e.sourceId === id)
      )
    ) {
      console.warn(
        '[synthesizer] citation validation warning: some citations not in evidence[].sourceId — fixing'
      )
      parsed.data.citations = parsed.data.citations.filter((id) =>
        [...evidenceById.values()].some((e) => e.sourceId === id)
      )
      if (parsed.data.citations.length === 0 && state.sources.length) {
        parsed.data.citations = [state.sources[0].sourceId]
        parsed.data.claims[0].citations = [state.sources[0].sourceId]
      }
    }

    return { report: parsed.data }
  }
}
