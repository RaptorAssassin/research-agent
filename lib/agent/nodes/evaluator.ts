import type { ResearchState } from "../state"
import type { LLMProvider } from "@/lib/llm/provider"
import { EvaluationSchema, type Evaluation } from "../schemas/evaluation"

export type EvaluatorDeps = {
  llm: LLMProvider
  maxIterations?: number
}

export function createEvaluatorNode(deps: EvaluatorDeps) {
  const maxIterations = deps.maxIterations ?? 2

  return async (state: typeof ResearchState.State): Promise<{ evaluation: Evaluation }> => {
    const evidenceBySource = new Map<string, number>()
    for (const e of state.evidence) evidenceBySource.set(e.sourceId, (evidenceBySource.get(e.sourceId) ?? 0) + 1)

    const unsupported = state.claims.filter((c) => c.status === "unsupported" || c.status === "unresolved").map((c) => c.statement)
    const conflicting = state.claims.filter((c) => c.status === "conflicting").map((c) => c.statement)
    const coverage = state.claims.length ? state.evidence.length / state.claims.length : 0

    const atMax = state.iteration >= maxIterations

    try {
      const out = await deps.llm.structuredGenerate(
        `Evaluate research report for query "${state.query}" at iteration ${state.iteration}/${maxIterations}.\nReport: ${JSON.stringify(state.report)?.slice(0, 4000)}\nClaims: ${state.claims.length} (unsupported: ${unsupported.length}), Evidence: ${state.evidence.length}, Sources: ${state.sources.length}, Conflicting: ${conflicting.length}\nDimensions to score 0-1: factuality, citationCorrectness, sourceQuality, relevance, evidenceCoverage. Decide needsMoreResearch (true only if gaps critical and not at max). List missingInfo, unsupportedClaims, contradictions, followUpQuestions. Respond ONLY JSON per schema, iteration=${state.iteration}.`,
        EvaluationSchema,
      )

      const clamped: Evaluation = {
        ...out,
        needsMoreResearch: atMax ? false : out.needsMoreResearch,
        iteration: state.iteration,
      }
      return { evaluation: clamped }
    } catch (err) {
      console.warn(`[evaluator] LLM failed: ${err instanceof Error ? err.message : String(err)} — heuristic fallback`)

      const factuality = supportedRatio(state)
      const citationOk = state.report ? citationCorrectness(state) : 0.5
      const sourceQuality = avg(state.sources.map((s) => s.credibility ?? 0.6))
      const relevance = avg(state.sources.map((s) => s.relevance ?? 0.6))
      const evidenceCoverage = Math.min(1, coverage / 2)

      const avgScore = (factuality + citationOk + sourceQuality + relevance + evidenceCoverage) / 5
      const needsMoreResearch = !atMax && (avgScore < 0.65 || unsupported.length > 0 || state.evidence.length < 3)

      const evaluation: Evaluation = {
        needsMoreResearch,
        reasoning: atMax ? "Max iterations reached; stopping." : needsMoreResearch ? "Heuristic: low coverage or unsupported claims warrant more research." : "Heuristic: evidence and citations sufficient.",
        confidence: avgScore,
        dimensions: { factuality, citationCorrectness: citationOk, sourceQuality, relevance, evidenceCoverage },
        missingInfo: needsMoreResearch ? ["Additional primary sources", "More verbatim evidence"] : [],
        unsupportedClaims: unsupported,
        contradictions: conflicting,
        followUpQuestions: needsMoreResearch ? state.plan?.subtasks.slice(0, 2).map((q) => `Follow-up: ${q}`) ?? [`More on ${state.query}`] : [],
        iteration: state.iteration,
      }
      return { evaluation }
    }
  }
}

function supportedRatio(state: { claims: { status?: string }[] }): number {
  if (state.claims.length === 0) return 0
  const good = state.claims.filter((c) => c.status === "supported" || c.status === "weakly_supported").length
  return good / state.claims.length
}

function citationCorrectness(state: { report: { citations: string[] } | null; evidence: { sourceId: string }[] }): number {
  if (!state.report) return 0.5
  const evSources = new Set(state.evidence.map((e) => e.sourceId))
  if (evSources.size === 0) return 0.3
  const ok = state.report.citations.filter((id) => evSources.has(id)).length
  return state.report.citations.length ? ok / state.report.citations.length : 0.5
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0.5
  return arr.reduce((a, b) => a + b, 0) / arr.length
}
