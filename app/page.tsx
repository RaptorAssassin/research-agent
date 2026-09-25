'use client'
import { Chat } from '@/components/chat'
import { SearchBar } from '@/components/search-bar'
import { useChatStore } from '@/lib/stores/chat-store'

export default function Home() {
  const runQuery = useChatStore((s) => s.runQuery)

  return (
    <main className="flex h-dvh w-dvw flex-col items-center overflow-hidden bg-zinc-950 selection:bg-zinc-700 selection:text-zinc-100">
      <div className="flex min-h-0 w-full flex-1 flex-col px-3 sm:px-4 md:mx-auto md:max-w-2/3 md:px-4">
        <Chat />
      </div>
      <div className="w-full shrink-0 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent px-3 pt-3 pb-5 sm:px-4 sm:pb-6 md:mx-auto md:max-w-2/3 md:px-4">
        <SearchBar run={runQuery} />
      </div>
    </main>
  )
}
