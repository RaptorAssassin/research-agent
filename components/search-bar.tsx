'use client'
import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '@/lib/stores/chat-store'

export function SearchBar({ run }: { run: (query: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const isStreaming = useChatStore((s) => s.streamingMessageId !== null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submitQuery = (raw: string) => {
    const query = raw.trim()
    if (!query || isStreaming) return
    run(query)
    setValue('')
    inputRef.current?.focus()
  }

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    submitQuery(value)
  }

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    submitQuery(value)
  }

  return (
    <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-2 shadow-xl shadow-black/30 sm:p-3">
      <form
        className="flex w-full items-center gap-2 sm:gap-3"
        onSubmit={handleFormSubmit}
      >
        <input
          type="text"
          inputMode="search"
          name="query"
          placeholder="Research Task"
          autoComplete="off"
          aria-label="Research task"
          disabled={isStreaming}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:opacity-50 sm:px-4 sm:text-[15px]"
          ref={inputRef}
        />
        <button
          type="button"
          onClick={handleButtonClick}
          disabled={isStreaming || !value.trim()}
          aria-label="Start research"
          className="shrink-0 rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-zinc-100 sm:px-5"
        >
          Search
        </button>
      </form>
    </div>
  )
}
