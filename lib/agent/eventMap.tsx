import type { AgentEventType } from './events'
import {
  Lightbulb,
  Search,
  Globe,
  ShieldCheck,
  Layers,
  BadgeCheck,
  FileText,
  Scale,
  Repeat,
} from 'lucide-react'

export type EventMeta = {
  label: string
  description: string
  Icon: React.ComponentType<{ className?: string }>
}

export const agentEventMap: Record<AgentEventType, EventMeta> = {
  planning: {
    label: 'Planning',
    description: '',
    Icon: Lightbulb,
  },
  search: {
    label: 'Searching',
    description: '',
    Icon: Search,
  },
  source_found: {
    label: 'Source Found',
    description: '',
    Icon: Globe,
  },
  source_evaluated: {
    label: 'Source Evaluated',
    description: '',
    Icon: ShieldCheck,
  },
  claim_extracted: {
    label: 'Claims Extracted',
    description: '',
    Icon: Layers,
  },
  fact_check: {
    label: 'Fact Check',
    description: '',
    Icon: BadgeCheck,
  },
  synthesis: {
    label: 'Synthesis',
    description: '',
    Icon: FileText,
  },
  evaluation: {
    label: 'Evaluation',
    description: '',
    Icon: Scale,
  },
  research_loop: {
    label: 'Research Loop',
    description: '',
    Icon: Repeat,
  },
}

export function getEventMeta(type: AgentEventType): EventMeta {
  return agentEventMap[type]
}
