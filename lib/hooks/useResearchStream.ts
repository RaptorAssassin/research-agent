'use client'
import { useState } from 'react'
import { type AgentEvent } from '../agent/events'

export function useResearchStream() {
  const [events, setEvents] = useState<AgentEvent[]>([])

  function appendEvent(event: AgentEvent) {
    setEvents((prevEvents) => [...prevEvents, event])
  }

  async function run(query: string, maxIterations?: number) {
    const res = fetch('/api/research', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        maxIterations,
        stream: true,
        mode: 'sse',
      }),
    })

    if (!(await res).ok) {
      throw new Error(`Request failed with status ${(await res).text()}`)
    }

    const reader = (await res).body?.getReader()
    if (!reader) {
      throw new Error('Failed to get reader from response body')
    }

    let buf = ''
    const decoder = new TextDecoder()

    while (true) {
      const { value, done } = await reader!.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const parts = buf.split('\n\n')
      buf = parts.pop() ?? ''

      for (const part of parts) {
        //const m = part.match(/^event: (.+)\ndata: (.+)$/s)
        const m = part.match(/^event: ([^\n]+)\ndata: ([\s\S]+)$/)

        if (!m) continue
        if (m[1] === 'error') throw new Error(JSON.parse(m[2]).error)
        if (m[1] === 'done') return

        const ev = JSON.parse(m[2]) as AgentEvent
        appendEvent(ev)
      }
    }
  }

  return { events, run }
}
