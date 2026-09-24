'use client'
import { Chat } from '@/components/chat'
import { SearchBar } from '@/components/search-bar'
import { useChatStore } from '@/lib/stores/chat-store'

export default function Home() {
  const runQuery = useChatStore((s) => s.runQuery)

  return (
    <main className="w-dvw h-dvh bg-zinc-950 selection:bg-zinc-700 selection:text-zinc-100 flex flex-col items-center overflow-hidden">
      <div className="flex min-h-0 flex-1 w-full max-w-2/3 flex-col px-4">
        <Chat />
      </div>
      <div className="w-full max-w-2/3 shrink-0 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent px-4 pb-5 pt-3 sm:pb-6">
        <SearchBar run={runQuery} />
      </div>
    </main>
  )
}

