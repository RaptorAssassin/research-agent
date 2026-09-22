'use client'
import { Check, CopyIcon, ShareIcon } from 'lucide-react'
import { useState } from 'react'

export function UserMessage({ message }: { message: string }) {
    return <div className="rounded-2xl p-4 bg-zinc-900 mt-4 self-end max-w-2/3">{message}</div>
}

export function AssistantMessage({ message }: { message: string }) {
    return (
        <div className="flex flex-col gap-1.5 self-start max-w-4/5">
            <div className="rounded-2xl p-4 bg-zinc-900 mt-4">{message}</div>
            <MessageActions text={message} />
        </div>
    )
}

function MessageActions({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-1 self-start px-1">
            <CopyButton text={text} />
            <ShareButton text={text} />
        </div>
    )
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch { }
    }

    return (
        <button
            onClick={handleCopy}
            type="button"
            aria-label={copied ? 'Copied' : 'Copy message'}
            title={copied ? 'Copied' : 'Copy'}
            className="inline-flex items-center justify-center rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 active:scale-[0.97] active:brightness-95 transition-[transform,background-color,color] duration-150"
        >
            {copied ? <Check className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
        </button>
    )
}

function ShareButton({ text }: { text: string }) {
    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({text: text, title: "Share text"})
            } catch (error) {
                console.error("Error sharing text:", error)
            }
        }
    }

    return <button onClick={handleShare} type="button"
        aria-label="Share message"
        title="Share"
        className="inline-flex items-center justify-center rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 active:scale-[0.97] active:brightness-95 transition-[transform,background-color,color] duration-150"
    >
        <ShareIcon className="h-4 w-4" />
    </button>
}