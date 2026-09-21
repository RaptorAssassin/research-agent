import { Chat } from '@/components/chat'
import { SearchBar} from '@/components/search-bar'

export default function Home() {
  return (
    <main className='w-dvw h-dvh bg-zinc-950 selection:bg-zinc-700 selection:text-zinc-100 flex items-center justify-center relative px-4'>
      <Chat />
      <SearchBar />

    </main>
  )
}

