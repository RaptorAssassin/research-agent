import type { SearchProvider, SourcePreview } from "./search"
import { z } from "zod"

const TavilyResultSchema = z.object({
  title: z.string(),
  url: z.url(),
  content: z.string(),
  score: z.number(),
  published_date: z.string().optional(),
})

const TavilyResponseSchema = z.object({
  results: z.array(TavilyResultSchema),
  query: z.string().optional(),
  response_time: z.number().optional(),
  request_id: z.string().optional(),
})

export type TavilySearchOptions = {
  apiKey?: string
  baseUrl?: string
  maxResults?: number
  searchDepth?: "basic" | "advanced" | "fast" | "ultra-fast"
  topic?: "general" | "news" | "finance"
  includeAnswer?: boolean
  includeRawContent?: boolean
}

function resolveMaxResults(explicit?: number): number {
  const raw = explicit ?? (process.env.TAVILY_MAX_RESULTS ? Number(process.env.TAVILY_MAX_RESULTS) : undefined)
  const parsed = raw ?? 3
  if (!Number.isFinite(parsed)) return 3
  const clamped = Math.max(1, Math.min(5, Math.round(parsed)))
  return clamped
}

export class TavilySearchProvider implements SearchProvider {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly maxResults: number
  private readonly searchDepth: NonNullable<TavilySearchOptions["searchDepth"]>
  private readonly topic: NonNullable<TavilySearchOptions["topic"]>
  private readonly includeAnswer: boolean
  private readonly includeRawContent: boolean

  constructor(opts: TavilySearchOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.TAVILY_API_KEY ?? ""
    this.baseUrl = opts.baseUrl ?? process.env.TAVILY_BASE_URL ?? "https://api.tavily.com"
    this.maxResults = resolveMaxResults(opts.maxResults)
    this.searchDepth = opts.searchDepth ?? (process.env.TAVILY_SEARCH_DEPTH as TavilySearchOptions["searchDepth"]) ?? "basic"
    this.topic = opts.topic ?? "general"
    this.includeAnswer = opts.includeAnswer ?? false
    this.includeRawContent = opts.includeRawContent ?? false

    if (this.searchDepth === "advanced") {
      console.warn("[Tavily] searchDepth='advanced' costs 2 credits/query (basic=1). Free plan: 1000 credits/month.")
    }
    if (opts.maxResults !== undefined && opts.maxResults > 5) {
      console.warn(`[Tavily] maxResults=${opts.maxResults} clamped to 5 for free-plan latency/budget. Use 3 for lowest cost.`)
    }
  }

  async searchWeb(query: string): Promise<SourcePreview[]> {
    const trimmed = query.trim()
    if (!trimmed) return []
    const normalizedQuery = trimmed.slice(0, 400)

    const body: Record<string, unknown> = {
      query: normalizedQuery,
      max_results: this.maxResults,
      search_depth: this.searchDepth,
      topic: this.topic,
      include_answer: this.includeAnswer,
      include_raw_content: this.includeRawContent,
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (this.apiKey) {
      body.api_key = this.apiKey
    } else {
      headers["X-Tavily-Access-Mode"] = "keyless"
    }

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/search`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })
    } catch (cause) {
      throw new Error(`Tavily search failed: ${cause instanceof Error ? cause.message : String(cause)}`)
    }

    if (!response.ok) {
      let detail = ""
      try {
        const errJson = (await response.json()) as { detail?: { error?: string }; error?: string }
        detail = errJson?.detail?.error ?? errJson?.error ?? JSON.stringify(errJson)
      } catch {
        detail = await response.text().catch(() => "")
      }

      if (response.status === 432) {
        throw new Error(`Tavily plan limit exceeded (432): ${detail} — free plan is 1000 credits/month (basic=1, advanced=2). Reduce maxResults or wait for monthly reset.`)
      }
      if (response.status === 433) {
        throw new Error(`Tavily pay-go limit exceeded (433): ${detail}`)
      }
      if (response.status === 429) {
        throw new Error(`Tavily rate limited (429): ${detail} — free tier ~1 req/s, standard ~30 req/min. Add backoff/retry.`)
      }

      throw new Error(`Tavily search failed ${response.status}: ${detail}`)
    }

    let json: unknown
    try {
      json = await response.json()
    } catch {
      throw new Error(`Tavily returned non-JSON response (status ${response.status})`)
    }

    const parsed = TavilyResponseSchema.safeParse(json)
    if (!parsed.success) {
      throw new Error(`Tavily response shape unexpected: ${z.prettifyError(parsed.error)}`)
    }

    return parsed.data.results.map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.content,
      publishedAt: r.published_date,
      score: r.score,
    }))
  }
}
