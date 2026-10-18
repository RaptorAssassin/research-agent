import type { AgentEvent, AgentEventType } from "./events"
import { createEvent } from "./events"
import type { Depth, ResearchState } from "./state"

export type RunnerStreamChunk =
  | { mode: "events"; event: AgentEvent }
  | { mode: "values"; state: typeof ResearchState.State }
  | { mode: "updates"; updates: Record<string, unknown> }

export function sseEncode(event: AgentEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

export function sseEncodeDone(): string {
  return `event: done\ndata: {"done":true}\n\n`
}

export async function* graphStreamToEvents(
  graph: { stream: (input: unknown, opts?: unknown) => Promise<AsyncIterable<Record<string, unknown>>> },
  input: Record<string, unknown>,
  opts?: { maxIterations?: number },
): AsyncGenerator<AgentEvent> {
  const stream = await graph.stream(input, { streamMode: "updates" } as unknown as Record<string, unknown>)

  for await (const chunk of stream) {
    const nodeName = Object.keys(chunk)[0]
    const data = (chunk as Record<string, unknown>)[nodeName] as unknown

    const typeMap: Record<string, AgentEvent["type"]> = {
      planner: "planning",
      researcher: "search",
      sourceEvaluator: "source_evaluated",
      extractor: "claim_extracted",
      factChecker: "fact_check",
      synthesizer: "synthesis",
      evaluator: "evaluation",
    }
    const type = typeMap[nodeName] ?? "research_loop"
    const iteration = (data as { iteration?: number })?.iteration ?? (input as { iteration?: number })?.iteration ?? 0
    yield createEvent(type, data, iteration)

    if (nodeName === "evaluator") {
      const ev = data as { evaluation?: { needsMoreResearch?: boolean } }
      if (ev?.evaluation?.needsMoreResearch) {
        yield createEvent("research_loop", { needsMoreResearch: true, next: "researcher" }, iteration + 1)
      }
    }
  }
}

export type StreamableGraph = {
  stream: (input: unknown, opts?: unknown) => Promise<AsyncIterable<Record<string, unknown>>>
}

export function mapNodeToEventType(node: string): AgentEventType {
  const m: Record<string, AgentEventType> = {
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

export async function* eventsFromGraph(
  activeGraph: StreamableGraph,
  query: string,
  depth: Depth,
): AsyncGenerator<AgentEvent> {
  const gen = await activeGraph.stream({ query, iteration: 0, depth }, { streamMode: "updates" })
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
