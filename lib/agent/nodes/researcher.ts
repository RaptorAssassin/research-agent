import type { Source } from "../schemas/claim"
import type { ResearchState } from "../state"
import type { SearchProvider, SourcePreview } from "@/lib/tools/search"
import type { ScrapeProvider } from "@/lib/tools/scrape"

export type ResearcherDeps = {
  searchProvider: SearchProvider
  scrapeProvider: ScrapeProvider
  maxSources?: number
  concurrency?: number
}

function dedupByUrl(previews: SourcePreview[]): SourcePreview[] {
  const byUrl = new Map<string, SourcePreview>()
  for (const p of previews) {
    const existing = byUrl.get(p.url)
    if (!existing || (p.score ?? 0) > (existing.score ?? 0)) {
      byUrl.set(p.url, p)
    }
  }
  return [...byUrl.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}

export function createResearcherNode(deps: ResearcherDeps) {
  const maxSources = deps.maxSources ?? 12
  const searchProvider = deps.searchProvider
  const scrapeProvider = deps.scrapeProvider

  return async (state: typeof ResearchState.State) => {
    if (!state.plan || state.plan.subtasks.length === 0) {
      return {
        sources: [] as Source[],
        iteration: state.iteration + 1,
      }
    }

    const isLoop = state.iteration > 0 && state.evaluation?.followUpQuestions && state.evaluation.followUpQuestions.length > 0
    const queries = isLoop ? state.evaluation!.followUpQuestions.slice(0, 3) : state.plan.subtasks

    const previewsPerTask = await Promise.all(
      queries.map(async (subtask) => {
        try {
          return await searchProvider.searchWeb(subtask)
        } catch (error) {
          console.warn(`[researcher] searchWeb failed for "${subtask}": ${error instanceof Error ? error.message : String(error)}`)
          return [] as SourcePreview[]
        }
      }),
    )

    const flat = previewsPerTask.flat()
    if (flat.length === 0) {
      return {
        sources: [] as Source[],
        iteration: state.iteration + 1,
      }
    }

    let deduped = dedupByUrl(flat).slice(0, maxSources)

    if (state.sources.length > 0) {
      const existingUrls = new Set(state.sources.map((s) => s.url))
      const filtered = deduped.filter((p) => !existingUrls.has(p.url))
      if (filtered.length > 0) deduped = filtered
    }

    const sources = await Promise.all(
      deduped.map(async (preview) => {
        let content: string | undefined
        try {
          content = await scrapeProvider.scrapePage(preview.url)
        } catch (error) {
          console.warn(`[researcher] scrapePage failed for ${preview.url}: ${error instanceof Error ? error.message : String(error)} — falling back to snippet`)
          content = preview.snippet
        }

        const source: Source = {
          sourceId: crypto.randomUUID(),
          url: preview.url,
          title: preview.title,
          snippet: preview.snippet,
          content: content ?? preview.snippet,
          publishedAt: preview.publishedAt,
        }

        return source
      }),
    )

    return {
      sources,
      iteration: state.iteration + 1,
    }
  }
}
