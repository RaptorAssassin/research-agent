# Research Agent — Streaming & Frontend Integration

No frontend is shipped yet, but `POST /api/research` is ready for any client. It wraps the full StateGraph:

`planner → researcher (searchWeb+scrapePage) → sourceEvaluator → extractor → factChecker → synthesizer → evaluator → (conditional) researcher | END`

Loop never returns to `planner` — `evaluation.needsMoreResearch && iteration < maxIterations (default 2)`.

## Endpoint

```
GET  /api/research?query=...&stream=true&mode=sse&maxIterations=2
POST /api/research
Content-Type: application/json
{ "query": "string", "stream": true|false, "mode": "sse|json|events|values|updates", "maxIterations": 0..5 }
```

Query is trimmed to 1000 chars, subtasks 3-5, `Tavily maxResults=3` (free: 1k credits/month, basic=1 credit/query, advanced=2).

## Modes — choose one per request

| mode | stream? | Content-Type | What you get | Use for |
|------|---------|--------------|--------------|---------|
| `json` (default if no stream) | false | `application/json` | Final `ResearchState` `{query,plan,sources,evidence,claims,report,evaluation,iteration}` | Simple fetch, no progress |
| `sse` | true | `text/event-stream` | `AgentEvent` SSE: `event: <type>\ndata: {...}\n\n` + `event: done` | **Recommended for UI** — progress bars, timeline |
| `events` | true | `application/x-ndjson` | One `AgentEvent` JSON per line (`\n` delimited) | `fetch` + `ReadableStream` line parser, easier than SSE |
| `values` | true | `text/event-stream` | LangGraph raw `values` stream (full state snapshot per node) | Debug, replicating LangGraph Studio |
| `updates` | true | `text/event-stream` | LangGraph raw `updates` stream (`{nodeName: partialState}`) | Debug |

Accept header `text/event-stream` also triggers `sse` if `mode` omitted.

## AgentEvent shape

```ts
type AgentEventType = "planning"|"search"|"source_found"|"source_evaluated"|"claim_extracted"|"fact_check"|"synthesis"|"evaluation"|"research_loop"
type AgentEvent = { timestamp:string, type:AgentEventType, iteration:number, data:unknown }
```

* `planning` data `ResearchPlan {objective, subtasks}`
* `search` data ` {sources: Source[], iteration}` + extra `source_found` events per source (first 3) for incremental UI
* `source_evaluated` data ` {sources: Source[]}` with `credibility/relevance/sourceType`
* `claim_extracted` data `{evidence: Evidence[], claims: Claim[]}`
* `fact_check` data `{claims: Claim[]}` with `status ∈ supported|weakly_supported|unsupported|conflicting|unresolved`
* `synthesis` data `{report: Report}` — 7 sections, `report.citations ⊆ evidence[].sourceId` validated
* `evaluation` data `{evaluation: Evaluation}` with `dimensions {factuality,citationCorrectness,sourceQuality,relevance,evidenceCoverage}`, `needsMoreResearch`, `followUpQuestions`
* `research_loop` data `{next:"researcher", iteration}` emitted when loop continues

All events have ISO `timestamp`.

## curl examples

```bash
# JSON (no stream) — final state
curl -X POST http://localhost:3000/api/research -H "Content-Type: application/json" -d '{"query":"LangGraph StateGraph vs Functional API"}' | jq

# SSE — live progress (recommended)
curl -N -X POST http://localhost:3000/api/research -H "Content-Type: application/json" -H "Accept: text/event-stream" -d '{"query":"LangGraph StateGraph vs Functional API","mode":"sse"}'

# With GET
curl -N "http://localhost:3000/api/research?query=LangGraph%20StateGraph&stream=true&mode=sse"

# NDJSON
curl -N -X POST http://localhost:3000/api/research -H "Content-Type: application/json" -d '{"query":"test","mode":"events"}'

# Force single iteration (no loop) for cheap free-plan test
curl -X POST http://localhost:3000/api/research -H "Content-Type: application/json" -d '{"query":"test","maxIterations":1}'

# Raw LangGraph values
curl -N -X POST http://localhost:3000/api/research -H "Content-Type: application/json" -d '{"query":"test","mode":"values"}'
```

## Frontend — copy-paste patterns

### React `useResearchStream` (SSE via EventSource)

`EventSource` only GET, so use fetch streaming:

```tsx
type AgentEvent = { timestamp:string, type:string, iteration:number, data:any }

export function useResearchStream() {
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [report, setReport] = useState<any>(null)

  const run = async (query:string) => {
    setEvents([]); setReport(null)
    const res = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type":"application/json", Accept:"text/event-stream" },
      body: JSON.stringify({ query, mode:"sse" })
    })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ""
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream:true })
      const parts = buf.split("\n\n")
      buf = parts.pop() ?? ""
      for (const part of parts) {
        const m = part.match(/^event: (.+)\ndata: (.+)$/s)
        if (!m) continue
        const [, evType, json] = m
        if (evType === "done") return
        if (evType === "error") throw new Error(JSON.parse(json).error)
        const ev = JSON.parse(json) as AgentEvent
        setEvents(prev => [...prev, ev])
        if (ev.type === "synthesis") setReport((ev.data as any).report)
        if (ev.type === "evaluation") setReport((prev)=> prev) // evaluation has report still
      }
    }
  }
  return { events, report, run }
}
```

**Timeline mapping:** `events.filter(e=>e.type==="planning")`, `source_found`, `claim_extracted`, etc. Use `e.iteration` to group loop iterations.

### NDJSON (simpler parser, no event: prefix)

```ts
const res = await fetch("/api/research",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,mode:"events"})})
const reader = res.body!.getReader()
let buf=""
while(true){
  const {value,done}=await reader.read()
  if(done) break
  buf+=new TextDecoder().decode(value,{stream:true})
  let nl
  while((nl=buf.indexOf("\n"))>=0){
    const line=buf.slice(0,nl).trim(); buf=buf.slice(nl+1)
    if(!line) continue
    const ev=JSON.parse(line) as AgentEvent
    console.log(ev.type, ev.data)
  }
}
```

### JSON (no streaming) — simplest

```ts
const res = await fetch("/api/research",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:"..."})})
const state = await res.json() // {report, evaluation, sources, claims, evidence}
```

## Build a page later — suggested routes

```
/research          → form + stream timeline + report
/research/[id]     → persisted report (add DB or localStorage later)
/evaluations       → radar chart of evaluation.dimensions
```

For `/research` use `mode:"sse"` and render events as vertical stepper. For final report, consume `synthesis` event `data.report` (already validated `citations ⊆ evidence[].sourceId`).

## Env — Ollama first

```
OLLAMA_MODEL=gemma4:12b              # or gemma3:12b cheap fallback
OLLAMA_CHEAP_MODEL=gemma4:12b        # planner/researcher/extractor
OLLAMA_STRONG_MODEL=gemma4:12b       # factChecker/synthesizer/evaluator (temp 0.2)
OLLAMA_BASE_URL=http://localhost:11434
TAVILY_API_KEY=tvly-...              # or empty → keyless (rate-limited)
TAVILY_MAX_RESULTS=3                 # 1..5, 3=free sweet spot
```

`ollama serve` must run, `ollama run gemma4:12b` once. Each node falls back to deterministic mock if LLM unreachable, so graph still completes without Ollama (lower quality).

## Invariants frontend can trust

* `report.citations` subset of `evidence[].sourceId` — validated in `synthesizer.ts`
* `claim.status` always one of 5, `conflicting` never collapsed
* `report` has 7 sections: `executiveSummary, findings, claims, citations, conflictingEvidence, limitations, sources, generatedAt`
* Never loop to planner, only `evaluator → researcher`

Ping `/api/research?query=test` for smoke test. See `lib/agent/graph.ts`, `lib/agent/events.ts`, `lib/agent/runner.ts`.
