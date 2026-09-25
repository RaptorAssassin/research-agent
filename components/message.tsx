'use client'
import { Check, CopyIcon, ShareIcon, ChevronDown, Brain } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { AssistantMessage as AssistantMessageType } from '@/lib/agent/schemas/message'
import { getEventMeta } from '@/lib/agent/eventMap'
import { motion, AnimatePresence } from 'motion/react'

export function UserMessage({ message }: { message: string }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      className="mt-4 max-w-2/3 self-end rounded-2xl bg-zinc-900 p-4 wrap-break-word"
    >
      <span className="min-w-0 wrap-break-word whitespace-pre-wrap">
        {message}
      </span>
    </motion.div>
  )
}

export function AssistantMessage({
  message,
}: {
  message: AssistantMessageType
}) {
  const text = message.content ?? ''
  const isStreaming = message.status === 'streaming'
  const isError = message.status === 'error'
  const hasContent = !!text

  const [isThinkingExpanded, setIsThinkingExpanded] = useState(!hasContent)
  const prevHasContentRef = useRef(hasContent)

  useEffect(() => {
    const had = prevHasContentRef.current
    if (!had && hasContent) {
      setIsThinkingExpanded(false)
    }
    if (had && !hasContent) {
      setIsThinkingExpanded(true)
    }
    prevHasContentRef.current = hasContent
  }, [hasContent])

  useEffect(() => {
    if (!hasContent && isStreaming && !isThinkingExpanded) {
      setIsThinkingExpanded(true)
    }
  }, [hasContent, isStreaming, isThinkingExpanded])

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      layout
      className="flex max-w-4/5 min-w-0 flex-col gap-1.5 self-start"
    >
      <motion.div
        layout
        className="mt-4 max-w-full min-w-0 overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-zinc-800"
      >
        <button
          type="button"
          onClick={() => setIsThinkingExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2.5 text-sm">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 ${isStreaming && isThinkingExpanded ? 'animate-pulse' : ''}`}
            >
              <Brain className="h-3.5 w-3.5 text-zinc-300" />
            </span>
            <span className="font-medium text-zinc-200">
              {isStreaming && !hasContent
                ? 'Thinking'
                : hasContent
                  ? `Thought for ${message.events.length} steps`
                  : 'Thinking'}
            </span>
            {isStreaming ? (
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500" />
                {isThinkingExpanded
                  ? `${message.events.length} steps`
                  : `${message.events.length} steps`}
              </span>
            ) : (
              <span className="text-xs text-zinc-500">
                · {message.events.length} events
              </span>
            )}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-300 ${isThinkingExpanded ? 'rotate-180' : 'rotate-0'}`}
          />
        </button>

        <AnimatePresence initial={false}>
          {isThinkingExpanded && (
            <motion.div
              key="thinking-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-1.5 px-4 pt-0 pb-3">
                {message.events.length > 0 ? (
                  message.events.map((event, i) => {
                    const { label, Icon } = getEventMeta(event.type)
                    return (
                      <motion.div
                        key={`${event.timestamp}-${i}-${event.type}`}
                        layout
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{
                          duration: 0.28,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="flex items-center gap-2 text-xs text-zinc-400"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="font-medium text-zinc-300">
                          {label}
                        </span>
                      </motion.div>
                    )
                  })
                ) : (
                  <span className="flex items-center gap-2 py-1 text-xs text-zinc-500">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-600" />
                    Gathering plan…
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {(hasContent || isError) && (
          <motion.div
            key="bubble"
            layout
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{
              duration: 0.52,
              ease: [0.22, 1, 0.36, 1],
              delay: 0.18,
            }}
            className="flex min-h-14 max-w-full min-w-0 flex-col gap-4 overflow-hidden rounded-2xl bg-zinc-900 p-4"
          >
            {isError && message.error ? (
              <p className="min-w-0 text-sm leading-relaxed [overflow-wrap:anywhere] break-words text-red-400">
                {message.error}
              </p>
            ) : (
              <>
                <p className="min-w-0 text-sm leading-relaxed [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                  {text}
                </p>

                {message.report && (
                  <div className="flex max-w-full min-w-0 flex-col gap-4 overflow-hidden border-t border-zinc-800 pt-4">
                    {message.report.findings.length > 0 && (
                      <div className="min-w-0 overflow-hidden">
                        <h4 className="mb-1.5 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                          Findings
                        </h4>
                        <ul className="flex min-w-0 flex-col gap-1.5">
                          {message.report.findings.map((f, idx) => (
                            <li
                              key={idx}
                              className="min-w-0 text-sm leading-relaxed [overflow-wrap:anywhere] break-words text-zinc-200"
                            >
                              <span className="text-zinc-500">· </span>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {message.report.claims.length > 0 && (
                      <div className="min-w-0 overflow-hidden">
                        <h4 className="mb-1.5 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                          Evidence-backed claims
                        </h4>
                        <ul className="flex flex-col gap-2">
                          {message.report.claims.map((c, idx) => (
                            <li
                              key={idx}
                              className="min-w-0 overflow-hidden rounded-lg bg-zinc-800/60 px-3 py-2"
                            >
                              <p className="min-w-0 text-sm leading-relaxed [overflow-wrap:anywhere] break-words text-zinc-200">
                                {c.statement}
                              </p>
                              <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                                <span className="shrink-0">
                                  confidence {(c.confidence * 100).toFixed(0)}%
                                  ·
                                </span>
                                {c.citations.map((sid) => {
                                  const src = message.report!.sources.find(
                                    (s) => s.sourceId === sid
                                  )
                                  return src ? (
                                    <a
                                      key={sid}
                                      href={src.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-block max-w-full truncate align-middle text-xs underline decoration-zinc-600 underline-offset-2 hover:text-zinc-300"
                                      title={`${src.title} — ${src.url}`}
                                    >
                                      {src.title.slice(0, 32)}
                                    </a>
                                  ) : null
                                })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {message.report.conflictingEvidence &&
                      message.report.conflictingEvidence.toLowerCase() !==
                        'no conflicts' &&
                      message.report.conflictingEvidence.toLowerCase() !==
                        'no conflicts — all sources agree' &&
                      message.report.conflictingEvidence.trim() !== '' && (
                        <div className="min-w-0 overflow-hidden rounded-lg bg-amber-950/30 px-3 py-2 ring-1 ring-amber-900/30">
                          <h4 className="mb-1 text-xs font-semibold text-amber-300">
                            Conflicting evidence
                          </h4>
                          <p className="min-w-0 text-xs leading-relaxed [overflow-wrap:anywhere] break-words text-zinc-300">
                            {message.report.conflictingEvidence}
                          </p>
                        </div>
                      )}

                    <div className="grid min-w-0 gap-3 overflow-hidden md:grid-cols-2">
                      <div className="min-w-0 overflow-hidden">
                        <h4 className="mb-1 text-xs font-semibold text-zinc-500">
                          Limitations
                        </h4>
                        <p className="min-w-0 text-xs leading-relaxed [overflow-wrap:anywhere] break-words text-zinc-400">
                          {message.report.limitations}
                        </p>
                      </div>
                      {message.report.sources.length > 0 && (
                        <div className="min-w-0 overflow-hidden">
                          <h4 className="mb-1 text-xs font-semibold text-zinc-500">
                            Sources · {message.report.sources.length}
                          </h4>
                          <ul className="flex min-w-0 flex-col gap-1 overflow-hidden">
                            {message.report.sources.map((s) => (
                              <li
                                key={s.sourceId}
                                className="min-w-0 overflow-hidden"
                              >
                                <a
                                  href={s.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block max-w-full truncate text-xs text-zinc-400 underline decoration-zinc-700 underline-offset-2 hover:text-zinc-200"
                                  title={`${s.title} — ${s.url}`}
                                >
                                  {s.title}
                                </a>
                                <span
                                  className="block max-w-full truncate text-[11px] leading-tight [overflow-wrap:anywhere] text-zinc-600"
                                  title={s.url}
                                >
                                  {s.url}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {hasContent && !isStreaming && <MessageActions text={text} />}
      {isError && message.error && <MessageActions text={message.error} />}
    </motion.div>
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
    } catch {}
  }

  return (
    <button
      onClick={handleCopy}
      type="button"
      aria-label={copied ? 'Copied' : 'Copy message'}
      title={copied ? 'Copied' : 'Copy'}
      className="inline-flex items-center justify-center rounded-lg p-1.5 text-zinc-400 transition-[transform,background-color,color] duration-150 hover:bg-zinc-800 hover:text-zinc-100 active:scale-[0.97] active:brightness-95"
    >
      {copied ? (
        <Check className="h-4 w-4" />
      ) : (
        <CopyIcon className="h-4 w-4" />
      )}
    </button>
  )
}

function ShareButton({ text }: { text: string }) {
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: text, title: 'Share text' })
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Share aborted')
          return
        }
        console.error('Error sharing text:', error)
      }
    }
  }

  return (
    <button
      onClick={handleShare}
      type="button"
      aria-label="Share message"
      title="Share"
      className="inline-flex items-center justify-center rounded-lg p-1.5 text-zinc-400 transition-[transform,background-color,color] duration-150 hover:bg-zinc-800 hover:text-zinc-100 active:scale-[0.97] active:brightness-95"
    >
      <ShareIcon className="h-4 w-4" />
    </button>
  )
}
