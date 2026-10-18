import { MAX_ITERATIONS, buildGraph, graph } from "@/lib/agent/graph"
import { createEvent, type AgentEvent } from "@/lib/agent/events"
import type { Report } from "@/lib/agent/schemas/report"
import type { Depth } from "@/lib/agent/state"
import { eventsFromGraph, type StreamableGraph } from "@/lib/agent/runner"

export type ResearchJob = {
  id: string
  query: string
  events: AgentEvent[]
  report?: Report
  status: "running" | "done" | "error"
  error?: string
  createdAt: number
  updatedAt: number
}

export type ResearchJobInput = {
  query: string
  depth?: Depth
  maxIterations?: number
}

const JOB_TTL_MS = 15 * 60 * 1000
const MAX_JOBS = 100

const jobs = new Map<string, ResearchJob>()

function evictStale() {
  const now = Date.now()
  for (const [id, job] of jobs) {
    if (job.status !== "running" && now - job.updatedAt > JOB_TTL_MS) {
      jobs.delete(id)
    }
  }
  if (jobs.size > MAX_JOBS) {
    const evictable = [...jobs.values()]
      .filter((job) => job.status !== "running")
      .sort((a, b) => a.updatedAt - b.updatedAt)
    for (const job of evictable) {
      if (jobs.size <= MAX_JOBS) break
      jobs.delete(job.id)
    }
  }
}

export function getJob(id: string): ResearchJob | undefined {
  evictStale()
  return jobs.get(id)
}

export function createJob(input: ResearchJobInput): ResearchJob {
  evictStale()
  const job: ResearchJob = {
    id: crypto.randomUUID(),
    query: input.query,
    events: [createEvent("research_loop", { status: "started", query: input.query }, 0)],
    status: "running",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  jobs.set(job.id, job)
  void runJob(job, input)
  return job
}

async function runJob(job: ResearchJob, input: ResearchJobInput) {
  const depth = input.depth ?? "standard"
  const maxIterations = input.maxIterations ?? MAX_ITERATIONS
  const activeGraph = maxIterations !== MAX_ITERATIONS ? buildGraph({ maxIterations }) : graph

  try {
    for await (const event of eventsFromGraph(activeGraph as unknown as StreamableGraph, input.query, depth)) {
      job.events.push(event)
      if (event.type === "synthesis" && (event.data as { report?: Report })?.report) {
        job.report = (event.data as { report: Report }).report
      }
      job.updatedAt = Date.now()
    }
    job.status = "done"
  } catch (err) {
    job.status = "error"
    job.error = err instanceof Error ? err.message : String(err)
    job.events.push(createEvent("research_loop", { error: job.error }, 0))
  } finally {
    job.updatedAt = Date.now()
  }
}
