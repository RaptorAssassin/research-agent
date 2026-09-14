<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Research Agent — Working Guide

Portfolio app: single LangGraph agent with staged nodes (not multi-agent). `CLAUDE.md` is alias to this file — keep in sync.

## Commands

- `pnpm@11.25.0` only — do not use npm/yarn (`package.json:packageManager`).
- `pnpm dev` — rewrites header block above on each run; commit it clean.
- `pnpm build` / `pnpm start` — prod build/serve.
- `pnpm lint` / `pnpm exec tsc --noEmit` — no test script yet; add one before using `pnpm test`.

## Stack & Config

- Next 16.3.5 / React 19.2.8 / TS 5 strict / Tailwind 4 / `zod@4.6.2` / `@langchain/langgraph@1.4.15`.
- `next.config.ts` empty; `postcss.config.mjs` uses `@tailwindcss/postcss` — no `tailwind.config.js`.
- Path alias `@/*` → `./*` (`tsconfig.json:22`). `lib/` is untracked — check `git status` before commit.
- `.env*` gitignored; Next.js loads env automatically. No CI / `.github` workflows.

## Architecture — Single Agent, Many Nodes

- Use `StateGraph` (Graph API), not Functional API — required for explicit branching/loops.
- Flow: `Query → Planner → Researcher (searchWeb + scrapePage) → Source Evaluator → Claim/Evidence Extraction → Fact Checker → Synthesizer → Report Evaluator → (conditional) → Researcher | END`.
- Loop condition: `evaluation.needsMoreResearch` back to Researcher, never Planner. One orchestrator, not autonomous sub-agents.
- Planned routes `/research`, `/research/[id]`, `/evaluations` not yet built — stream progress via SSE with structured `AgentEvent`s.

## State & Schemas

- State: `lib/agent/state.ts` (stub `graph.ts:1` only `StateGraph` import) — shape `ResearchState { query, plan, sources, claims, evidence, report, evaluation, iteration }`. Nodes update slices, never large strings.
- Zod is runtime source of truth: `ResearchPlanSchema`, `SourceSchema`, `ClaimSchema`, `EvidenceSchema`, `EvaluationSchema`, `ReportSchema` in `lib/agent/schemas/<domain>.ts` (`FooSchema` → `Foo` via `z.infer`). Current: `plan.ts` and `claim.ts` have real schemas; `evaluation.ts` empty, `graph.ts`/`state.ts` stubs, `lib/tools/` empty, `lib/agent/nodes/{planner,researcher,factChecker}.ts` 0-byte placeholders.
- Hierarchy: `Source (sourceId) → Evidence (evidenceId, sourceId, text, location) → Claim (claimId, statement, confidence, evidenceIds[] non-empty)`.

## Invariants — Fail Review If Broken

- No invented citations: `report.citations ⊆ evidence[].sourceId`; validate explicitly.
- Structured over prose: Planner → `ResearchPlan { objective, subtasks[] }`; Synthesizer consumes `Claim[]`/`Evidence[]`, not chat history.
- Source evaluation = deterministic signals + LLM (relevance, credibility, freshness, primary vs secondary).
- Fact Checker statuses: `supported | weakly_supported | unsupported | conflicting | unresolved` — keep `conflicting` explicit.
- `lib/llm/` must abstract `interface LLMProvider { generate; structuredGenerate }` — do not import `openai`/`anthropic` SDKs directly in nodes; planner/researcher = cheap model, fact-check/synthesizer/evaluator = strong.
- Web research is two tools: `searchWeb(query)` discovers URLs, `scrapePage(url)` retrieves content — search snippets ≠ evidence.
- Report shape: Executive Summary, Findings, Evidence-backed claims, Citations, Conflicting evidence/uncertainty, Limitations, Sources.
- Events: `AgentEvent { timestamp, type, data }` with `type ∈ planning | search | source_found | source_evaluated | claim_extracted | fact_check | synthesis | evaluation | research_loop`.

## Conventions

- Do not add code comments — explain via names and structure instead.
- Verify docs vs executable source: trust `package.json`, `tsconfig.json`, `eslint.config.mjs`, `pnpm-workspace.yaml`, and actual `lib/` contents over prose.
