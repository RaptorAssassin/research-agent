import {
  type AssistantMessage,
  type ChatMessage,
} from '../agent/schemas/message'
import type { AgentEvent } from '../agent/events'
import type { Report } from '../agent/schemas/report'
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
              updates.content = data.report.executiveSummary
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

    const { addUserMessage, startAssistantMessage, appendEvent, setAssistantStatus } = get()

    addUserMessage(trimmed)
    const assistantId = startAssistantMessage(trimmed)

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: trimmed,
          maxIterations,
          stream: true,
          mode: 'sse',
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Request failed with status ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) {
        throw new Error('Failed to get reader from response body')
      }

      let buf = ''
      const decoder = new TextDecoder()

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''

        for (const part of parts) {
          const m = part.match(/^event: ([^\n]+)\ndata: ([\s\S]+)$/)
          if (!m) continue
          if (m[1] === 'error') {
            const parsed = JSON.parse(m[2]) as { error: string }
            throw new Error(parsed.error)
          }
          if (m[1] === 'done') {
            setAssistantStatus(assistantId, 'complete')
            set({ streamingMessageId: null })
            return
          }

          const ev = JSON.parse(m[2]) as AgentEvent
          appendEvent(assistantId, ev)
        }
      }

      setAssistantStatus(assistantId, 'complete')
      set({ streamingMessageId: null })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      get().setAssistantStatus(assistantId, 'error', msg)
      set({ streamingMessageId: null })
    }
  },
}))
