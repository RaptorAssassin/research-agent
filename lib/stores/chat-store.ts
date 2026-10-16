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

    const handleEventBlock = (block: string): boolean => {
      const parsed = parseSseBlock(block)
      if (!parsed) return false
      if (parsed.type === 'error') {
        const data = JSON.parse(parsed.payload) as { error: string }
        throw new Error(data.error)
      }
      if (parsed.type === 'done') {
        setAssistantStatus(assistantId, 'complete')
        set({ streamingMessageId: null })
        return true
      }
      appendEvent(assistantId, JSON.parse(parsed.payload) as AgentEvent)
      return false
    }

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

      const drain = () => {
        const parts = buf.split(/\r?\n\r?\n/)
        buf = parts.pop() ?? ''
        for (const part of parts) {
          if (handleEventBlock(part)) return true
        }
        return false
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        if (drain()) return
      }
      buf += decoder.decode()
      if (buf.trim() && handleEventBlock(buf)) return

      setAssistantStatus(assistantId, 'complete')
      set({ streamingMessageId: null })
    } catch (err) {
      const msg = describeStreamError(err)
      get().setAssistantStatus(assistantId, 'error', msg)
      set({ streamingMessageId: null })
    }
  },
}))

function parseSseBlock(block: string): { type: string; payload: string } | null {
  let type = ''
  const dataLines: string[] = []
  for (const rawLine of block.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) {
      type = line.slice('event:'.length).trim()
    } else if (line.startsWith('data:')) {
      const rest = line.slice('data:'.length)
      dataLines.push(rest.startsWith(' ') ? rest.slice(1) : rest)
    }
  }
  if (dataLines.length === 0) return null
  return { type: type || 'message', payload: dataLines.join('\n') }
}

function describeStreamError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'Request was cancelled'
  }
  const msg = err instanceof Error ? err.message : String(err)
  if (err instanceof TypeError) {
    return `Connection lost while streaming (${msg}) — a proxy or the server may have closed the idle connection; try again`
  }
  return msg
}
