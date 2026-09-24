'use client'
import { useEffect, useRef } from "react"

export function SearchBar({ run }: { run: (query: string) => void }) {
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)
    const raw = formData.get("query") as string
    const query = raw.trim()

    if (!query) return

    run(query)
    e.currentTarget.reset()
    inputRef.current?.focus()
  }

  return (
    <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-2 shadow-xl shadow-black/30 sm:p-3">
      <form
        className="flex w-full items-center gap-2 sm:gap-3"
        onSubmit={handleSubmit}
      >
        <input
          type="text"
          inputMode="search"
          name="query"
          placeholder="Research Task"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none sm:px-4 sm:text-[15px]"
          ref={inputRef}
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white active:scale-[0.97] sm:px-5"
        >
          Search
        </button>
      </form>
    </div>
  )
}