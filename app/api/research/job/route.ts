import { createJob, getJob } from "@/lib/agent/jobs"
import { parseDepth } from "@/lib/agent/state"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const url = new URL(req.url)
  let body: unknown = null
  try {
    body = await req.json()
  } catch {
    body = null
  }

  const payload = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const query = (typeof payload.query === "string" ? payload.query : url.searchParams.get("query") ?? "").trim()
  if (!query) {
    return Response.json({ error: "Missing query" }, { status: 400 })
  }

  const maxIterations = typeof payload.maxIterations === "number" ? Math.max(0, Math.min(5, Math.round(payload.maxIterations))) : undefined
  const depth = parseDepth(payload.depth ?? url.searchParams.get("depth"))

  const job = createJob({ query: query.slice(0, 1000), depth, maxIterations })
  return Response.json({ jobId: job.id, status: job.status }, { headers: { "Cache-Control": "no-store" } })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const jobId = url.searchParams.get("jobId") ?? ""
  const rawCursor = Number.parseInt(url.searchParams.get("cursor") ?? "0", 10)
  const cursor = Number.isFinite(rawCursor) && rawCursor > 0 ? rawCursor : 0

  const job = getJob(jobId)
  if (!job) {
    return Response.json({ error: "Unknown or expired job" }, { status: 404 })
  }

  const events = job.events.slice(cursor)
  return Response.json(
    {
      jobId: job.id,
      status: job.status,
      error: job.error,
      cursor: cursor + events.length,
      events,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
