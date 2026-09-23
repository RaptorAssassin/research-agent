import { z } from 'zod'
import { ReportSchema } from './report'
import { type AgentEvent } from '../events'

export const UserMessageSchema = z.object({
  id: z.uuid(),
  role: z.literal('user'),
  content: z.string().min(1),
  createdAt: z.iso.datetime(),
})

export const AssistantMessageSchema = z.object({
  id: z.uuid(),
  role: z.literal('assistant'),
  createdAt: z.iso.datetime(),
  status: z.enum(['streaming', 'complete', 'error']),
  content: z.string().optional(),
  events: z.array(z.custom<AgentEvent>()),
  report: ReportSchema.optional(),
  query: z.string().optional(),
  error: z.string().optional(),
})

export const MessageSchema = z.discriminatedUnion('role', [
  UserMessageSchema,
  AssistantMessageSchema,
])
export type UserMessage = z.infer<typeof UserMessageSchema>
export type AssistantMessage = z.infer<typeof AssistantMessageSchema>
export type ChatMessage = z.infer<typeof MessageSchema>
