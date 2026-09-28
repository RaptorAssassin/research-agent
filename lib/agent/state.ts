import { Annotation } from '@langchain/langgraph'
import { type ResearchPlan } from './schemas/plan'
import { type Claim, type Source } from './schemas/claim'
import { type Evidence } from './schemas/claim'
import { type Report } from './schemas/report'
import { type Evaluation } from './schemas/evaluation'

export const DepthValues = ['brief', 'standard', 'deep'] as const

export type Depth = (typeof DepthValues)[number]

export function parseDepth(value: unknown): Depth {
  return typeof value === 'string' &&
    (DepthValues as readonly string[]).includes(value.trim().toLowerCase())
    ? (value.trim().toLowerCase() as Depth)
    : 'standard'
}

export const ResearchState = Annotation.Root({
  query: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  plan: Annotation<ResearchPlan | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  sources: Annotation<Source[]>({
    reducer: (prev, next) => [
      ...new Map([...prev, ...next].map((s) => [s.sourceId, s])).values(),
    ],
    default: () => [],
  }),
  evidence: Annotation<Evidence[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),
  claims: Annotation<Claim[]>({
    reducer: (prev, next) => [
      ...new Map([...prev, ...next].map((c) => [c.claimId, c])).values(),
    ],
    default: () => [],
  }),
  report: Annotation<Report | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  evaluation: Annotation<Evaluation | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  iteration: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  depth: Annotation<Depth>({
    reducer: (_prev, next) => next,
    default: () => 'standard',
  }),
})
