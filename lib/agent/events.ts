export const AgentEventTypeSchema = [
  "planning",
  "search",
  "source_found",
  "source_evaluated",
  "claim_extracted",
  "fact_check",
  "synthesis",
  "evaluation",
  "research_loop",
] as const

export type AgentEventType = (typeof AgentEventTypeSchema)[number]

export type AgentEvent = {
  timestamp: string
  type: AgentEventType
  iteration: number
  data: unknown
}

export function createEvent(type: AgentEventType, data: unknown, iteration = 0): AgentEvent {
  return {
    timestamp: new Date().toISOString(),
    type,
    iteration,
    data,
  }
}

export type StreamMode = "sse" | "json" | "events" | "values" | "updates"

export const StreamModeValues = ["sse", "json", "events", "values", "updates"] as const

export function isStreamMode(v: string): v is StreamMode {
  return (StreamModeValues as readonly string[]).includes(v)
}
