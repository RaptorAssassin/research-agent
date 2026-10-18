import {
  type AssistantMessage,
  type ChatMessage,
} from '../agent/schemas/message'
import type { AgentEvent } from '../agent/events'
import type { Report } from '../agent/schemas/report'
import { buildReportMarkdown } from '../agent/report-markdown'
import { create } from 'zustand'

type ChatStore = {
  messages: ChatMessage[]
  streamingMessageId: string | null

  addUserMessage: (content: string) => string
  startAssistantMessage: (query: string) => string
  appendEvent: (assistantId: string, event: AgentEvent) => void
  setAssistantContent: (
    assistantId: string,
    content: string,
    report?: Report
  ) => void
  setAssistantStatus: (
    assistantId: string,
    status: AssistantMessage['status'],
    error?: string
  ) => void
  clearMessages: () => void
  runQuery: (query: string, maxIterations?: number) => Promise<void>
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  streamingMessageId: null,

  addUserMessage: (content) => {
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    set((state) => ({
      messages: [...state.messages, newMessage],
    }))
    return newMessage.id
  },

  startAssistantMessage: (query) => {
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      createdAt: new Date().toISOString(),
      status: 'streaming',
      content: undefined,
      events: [],
      report: undefined,
      query,
      error: undefined,
    }
    set((state) => ({
      messages: [...state.messages, newMessage],
      streamingMessageId: newMessage.id,
    }))
    return newMessage.id
  },

  appendEvent: (assistantId, event) => {
    set((state) => ({
      messages: state.messages.map((message) => {
        if (message.id === assistantId && message.role === 'assistant') {
          const updates: Partial<AssistantMessage> = {}

          if (event.type === 'synthesis') {
            const data = event.data as { report?: Report }
            if (data?.report) {
              updates.report = data.report
              updates.content = buildReportMarkdown(data.report)
            }
          }

          return {
            ...message,
            events: [...message.events, event],
            ...updates,
          }
        }
        return message
      }),
    }))
  },

  setAssistantContent: (assistantId, content, report) => {
    set((state) => ({
      messages: state.messages.map((message) => {
        if (message.id === assistantId && message.role === 'assistant') {
          return {
            ...message,
            content,
            ...(report ? { report } : {}),
          }
        }
        return message
      }),
    }))
  },

  setAssistantStatus: (assistantId, status, error) => {
    set((state) => ({
      messages: state.messages.map((message) => {
        if (message.id === assistantId && message.role === 'assistant') {
          return {
            ...message,
            status,
            error,
          }
        }
        return message
      }),
    }))
  },

  clearMessages: () => {
    set({
      messages: [],
      streamingMessageId: null,
    })
  },

  runQuery: async (query, maxIterations) => {
    const trimmed = query.trim()
    if (!trimmed) return
    if (get().streamingMessageId) return

    const { addUserMessage, startAssistantMessage, appendEvent, setAssistantStatus } = get()

    addUserMessage(trimmed)
    const assistantId = startAssistantMessage(trimmed)

    try {
      const startRes = await fetch('/api/research/job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: trimmed,
          maxIterations,
        }),
      })

      if (!startRes.ok) {
        throw new Error(await readErrorDetail(startRes))
      }

      const started = (await startRes.json()) as { jobId: string }
      const deadline = Date.now() + 10 * 60 * 1000
      let cursor = 0

      for (;;) {
        if (Date.now() > deadline) {
          throw new Error('Timed out waiting for the research job to finish')
        }

        const pollRes = await fetch(
          `/api/research/job?jobId=${encodeURIComponent(started.jobId)}&cursor=${cursor}`,
          { cache: 'no-store' }
        )

        if (!pollRes.ok) {
          throw new Error(await readErrorDetail(pollRes))
        }

        const data = (await pollRes.json()) as {
          status: 'running' | 'done' | 'error'
          error?: string
          cursor: number
          events: AgentEvent[]
        }

        cursor = data.cursor
        for (const event of data.events) {
          appendEvent(assistantId, event)
        }

        if (data.status === 'error') {
          throw new Error(data.error ?? 'Research job failed')
        }

        if (data.status === 'done') {
          setAssistantStatus(assistantId, 'complete')
          set({ streamingMessageId: null })
          return
        }

        await new Promise((resolve) => setTimeout(resolve, 700))
      }
    } catch (err) {
      const msg = describeStreamError(err)
      get().setAssistantStatus(assistantId, 'error', msg)
      set({ streamingMessageId: null })
    }
  },
}))

async function readErrorDetail(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  return data?.error ?? `Request failed with status ${res.status}`
}

function describeStreamError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'Request was cancelled'
  }
  const msg = err instanceof Error ? err.message : String(err)
  if (err instanceof TypeError) {
    return `Connection lost while contacting the server (${msg}) — check your network and try again`
  }
  return msg
}
