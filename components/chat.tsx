import { UserMessage, AssistantMessage } from './message'
import { useChatStore } from '@/lib/stores/chat-store'
import { useEffect, useRef } from 'react'

export function Chat() {
  const messages = useChatStore((s) => s.messages)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12">
        <p className="text-sm text-zinc-500">No messages yet</p>
        <p className="text-xs text-zinc-600">Try a research task below</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-y-auto pt-6 pb-4">
      {messages.map((message) =>
        message.role === 'user' ? (
          <UserMessage key={message.id} message={message.content} />
        ) : (
          <AssistantMessage key={message.id} message={message} />
        )
      )}
      <div ref={bottomRef} className="h-2 shrink-0" />
    </div>
  )
}
