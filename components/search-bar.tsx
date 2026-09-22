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
    const query = formData.get("query") as string
    query.trim()

    if (!query) return

    console.log("Search query:", query)

    run(query)
  }

  return <div className="rounded-2xl absolute bottom-10 left-1/2 -translate-x-1/2 p-4 bg-zinc-900 w-full max-w-4/5 md:max-w-2/3">
      <form className="w-full h-full flex items-center justify-center gap-2" onSubmit={handleSubmit}>
    <input type="text" inputMode="search" name="query" placeholder="Research Task" autoComplete="off" className="focus:outline-none w-full" ref={inputRef}/>
    <div className="p-2 overflow-hidden w-25 h-15 flex items-center justify-center">
    <button type="submit" className="rounded-4xl focus-visible:border-solid p-2 bg-zinc-300 text-zinc-700 active:scale-97 transition-all transition-delay-200 focus-visible:border-zinc-900 border-none outline-none focus-visible:border-2 focus-visible:scale-103">Search</button>
    </div>
  </form>
  </div>
}