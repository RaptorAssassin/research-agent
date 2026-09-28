import type { Source } from "../schemas/claim"
import type { ResearchState } from "../state"

function deterministicSignals(source: Source, query: string): { credibility: number; relevance: number; sourceType: "primary" | "secondary"; freshness: number } {
  const url = source.url.toLowerCase()
  const queryTokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  const haystack = `${source.title} ${source.snippet ?? ""} ${source.content?.slice(0, 1000) ?? ""}`.toLowerCase()

  let overlap = 0
  for (const tok of queryTokens) if (haystack.includes(tok)) overlap++
  const relevance = queryTokens.length ? Math.min(1, overlap / queryTokens.length) : 0.5

  let credibility = 0.6
  if (url.includes("wikipedia.org") || url.includes("arxiv.org") || url.includes("nature.com") || url.includes("reuters.com") || url.includes("bbc.")) credibility = 0.85
  else if (url.includes("medium.com") || url.includes("blog") || url.includes("substack")) credibility = 0.5
  else if (url.endsWith(".gov") || url.endsWith(".edu")) credibility = 0.9

  const sourceType: "primary" | "secondary" = url.includes("arxiv") || url.includes("doi.org") || source.title.toLowerCase().includes("study") ? "primary" : "secondary"

  let freshness = 0.5
  if (source.publishedAt) {
    const ageMs = Date.now() - new Date(source.publishedAt).getTime()
    const days = ageMs / (1000 * 60 * 60 * 24)
    if (days < 7) freshness = 1
    else if (days < 30) freshness = 0.85
    else if (days < 180) freshness = 0.65
    else if (days < 365) freshness = 0.45
    else freshness = 0.3
  }

  return { credibility, relevance, sourceType, freshness }
}

export function createSourceEvaluatorNode() {
  return async (state: typeof ResearchState.State): Promise<{ sources: Source[] }> => {
    if (state.sources.length === 0) return { sources: [] }

    const evaluated = state.sources.map((source) => {
      const det = deterministicSignals(source, state.query)
      return {
        ...source,
        credibility: det.credibility,
        relevance: det.relevance,
        sourceType: det.sourceType,
      }
    })

    evaluated.sort((a, b) => ((b.relevance ?? 0) * 0.6 + (b.credibility ?? 0) * 0.4) - ((a.relevance ?? 0) * 0.6 + (a.credibility ?? 0) * 0.4))

    return { sources: evaluated }
  }
}
