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
      <div className="h-full flex flex-col items-center justify-start gap-2 w-full md:max-w-2/3 pt-8">
        <p className="text-sm text-zinc-500 mt-12">No messages yet</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col items-center justify-start gap-2 w-full md:max-w-2/3 pt-8 overflow-y-auto pb-32">
      {messages.map((message) =>
        message.role === 'user' ? (
          <UserMessage key={message.id} message={message.content} />
        ) : (
          <AssistantMessage key={message.id} message={message} />
        )
      )}
      <div ref={bottomRef} className="h-0" />
    </div>
  )
}
