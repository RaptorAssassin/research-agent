import { graph, buildGraph, MAX_ITERATIONS } from "@/lib/agent/graph"
import { createEvent, isStreamMode, type StreamMode } from "@/lib/agent/events"
import { sseEncode, sseEncodeDone } from "@/lib/agent/runner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ResearchRequest = {
  query: string
  stream?: boolean
  mode?: StreamMode
  maxIterations?: number
}

function parseRequest(body: unknown, searchParams: URLSearchParams): ResearchRequest | { error: string } {
  const qParam = searchParams.get("query")
  const modeParam = searchParams.get("mode")
  const streamParam = searchParams.get("stream")

  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>
    const query = typeof b.query === "string" ? b.query.trim() : qParam?.trim() ?? ""
    if (!query) return { error: "Missing query" }
    const stream = typeof b.stream === "boolean" ? b.stream : streamParam === "true"
    const mode = typeof b.mode === "string" && isStreamMode(b.mode) ? (b.mode as StreamMode) : modeParam && isStreamMode(modeParam) ? (modeParam as StreamMode) : undefined
    const maxIterations = typeof b.maxIterations === "number" ? Math.max(0, Math.min(5, Math.round(b.maxIterations))) : undefined
    return { query, stream, mode, maxIterations }
  }

  const query = qParam?.trim() ?? ""
  if (!query) return { error: "Missing query (send JSON {query} or ?query=...)" }
  const stream = streamParam === "true"
  const mode = modeParam && isStreamMode(modeParam) ? (modeParam as StreamMode) : undefined
  return { query, stream, mode, maxIterations: undefined }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const parsed = parseRequest(null, url.searchParams)
  if ("error" in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 })
  }
  return handleResearch(parsed, req)
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  let body: unknown = null
  try {
    body = await req.json()
  } catch {
    try {
      const text = await req.text()
      if (text) {
        const trimmed = text.trim()
        const cleaned = trimmed.startsWith("'") && trimmed.endsWith("'") ? trimmed.slice(1, -1).replace(/\\"/g, '"') : trimmed
        body = JSON.parse(cleaned)
      }
    } catch {
      // empty body -> use query params
    }
  }
  const parsed = parseRequest(body, url.searchParams)
  if ("error" in parsed) {
    return Response.json({ error: parsed.error, hint: "Windows PowerShell: use curl.exe or Invoke-RestMethod, see examples below" }, { status: 400 })
  }
  return handleResearch(parsed, req)
}

async function handleResearch(req: ResearchRequest, originalReq: Request) {
  const query = req.query.slice(0, 1000)
  const maxIterations = req.maxIterations ?? MAX_ITERATIONS
  const wantsStream = req.stream === true || req.mode !== undefined || originalReq.headers.get("accept")?.includes("text/event-stream")

  const mode: StreamMode = req.mode ?? (wantsStream ? "sse" : "json")

  const activeGraph = maxIterations !== MAX_ITERATIONS ? buildGraph({ maxIterations }) : graph

  if (mode === "json" && !wantsStream) {
    try {
      const result = (await activeGraph.invoke({ query, iteration: 0 })) as Record<string, unknown>
      return Response.json(result, { headers: { "Cache-Control": "no-store" } })
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder()

      const enqueue = (str: string) => controller.enqueue(encoder.encode(str))

      try {
        if (mode === "values" || mode === "updates") {
          const streamMode = mode as "values" | "updates"
          const gen = await (activeGraph.stream as unknown as (input: unknown, opts: unknown) => Promise<AsyncIterable<unknown>>)({ query, iteration: 0 }, { streamMode })
          for await (const chunk of gen) {
            if (originalReq.signal.aborted) break
            if (mode === "values") {
              enqueue(`data: ${JSON.stringify({ type: "values", data: chunk })}\n\n`)
            } else {
              const nodeName = Object.keys(chunk as Record<string, unknown>)[0]
              const data = (chunk as Record<string, unknown>)[nodeName]
              const ev = createEvent(mapNodeToEventType(nodeName), data, (data as { iteration?: number })?.iteration ?? 0)
              enqueue(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`)
            }
          }
          enqueue(sseEncodeDone())
          controller.close()
          return
        }

        if (mode === "events") {
          for await (const chunk of eventsFromGraph(activeGraph, query)) {
            if (originalReq.signal.aborted) break
            enqueue(`${JSON.stringify(chunk)}\n`)
          }
          controller.close()
          return
        }

        for await (const ev of eventsFromGraph(activeGraph, query)) {
          if (originalReq.signal.aborted) break
          enqueue(sseEncode(ev))
        }
        enqueue(sseEncodeDone())
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        try {
          enqueue(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`)
        } catch {}
        controller.close()
      }
    },
    cancel() {
      // client disconnected
    },
  })

  const headers: Record<string, string> = {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  }

  if (mode === "events") {
    headers["Content-Type"] = "application/x-ndjson"
  } else if (mode === "values" || mode === "updates") {
    headers["Content-Type"] = "text/event-stream"
  } else {
    headers["Content-Type"] = "text/event-stream"
  }

  return new Response(stream, { headers })
}

function mapNodeToEventType(node: string): import("@/lib/agent/events").AgentEventType {
  const m: Record<string, import("@/lib/agent/events").AgentEventType> = {
    planner: "planning",
    researcher: "search",
    sourceEvaluator: "source_evaluated",
    extractor: "claim_extracted",
    factChecker: "fact_check",
    synthesizer: "synthesis",
    evaluator: "evaluation",
  }
  return m[node] ?? "research_loop"
}

async function* eventsFromGraph(
  activeGraph: typeof graph,
  query: string,
): AsyncGenerator<import("@/lib/agent/events").AgentEvent> {
  const gen = await (activeGraph.stream as unknown as (input: unknown, opts: unknown) => Promise<AsyncIterable<Record<string, unknown>>>)({ query, iteration: 0 }, { streamMode: "updates" })
  for await (const chunk of gen) {
    const nodeName = Object.keys(chunk)[0]
    const data = chunk[nodeName] as { iteration?: number } & Record<string, unknown>
    const iteration = data?.iteration ?? 0
    yield createEvent(mapNodeToEventType(nodeName), data, iteration)
    if (nodeName === "evaluator" && (data as { evaluation?: { needsMoreResearch?: boolean } })?.evaluation?.needsMoreResearch) {
      yield createEvent("research_loop", { next: "researcher", iteration: iteration + 1 }, iteration + 1)
    }
    if (nodeName === "researcher" && Array.isArray((data as { sources?: unknown[] })?.sources)) {
      const sources = (data as { sources: { url: string; title: string; sourceId: string }[] }).sources
      for (const s of sources.slice(0, 3)) {
        yield createEvent("source_found", s, iteration)
      }
    }
  }
}
