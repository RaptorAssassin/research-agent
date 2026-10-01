'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      disallowedElements={['img']}
      components={{
        p: ({ children }) => (
          <p className="text-sm leading-relaxed text-zinc-200 not-last:mb-2">
            {children}
          </p>
        ),
        h1: ({ children }) => (
          <h1 className="mt-4 mb-2 text-base font-semibold text-zinc-100 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-4 mb-2 text-sm font-semibold text-zinc-100 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-3 mb-1.5 text-sm font-semibold text-zinc-200">
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="mt-3 mb-1.5 text-sm font-medium text-zinc-200">
            {children}
          </h4>
        ),
        ul: ({ children }) => (
          <ul className="list-outside list-disc pl-5 text-sm text-zinc-200 not-last:mb-2">
            {children}
          </ul>
        ),
        ol: ({ children, start }) => (
          <ol
            className="list-outside list-decimal pl-5 text-sm text-zinc-200 not-last:mb-2"
            start={start}
          >
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="mt-1 leading-relaxed marker:text-zinc-500 [&>p]:inline">
            {children}
          </li>
        ),
        strong: ({ children }) => (
          <strong className="font-bold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        a: ({ href, children }) => (
          <a
            className="text-blue-400 hover:underline"
            href={href}
            rel="noopener noreferrer"
            target="_blank"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-zinc-500 pl-4 italic not-last:mb-2">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-4 border-zinc-700" />,
        pre: ({ children }) => (
          <pre className="overflow-x-auto rounded-md bg-zinc-800 p-4 not-last:mb-2">
            {children}
          </pre>
        ),
        code: ({ children, className }) => {
          return (
            <code className="rounded-md bg-zinc-800 p-1 font-mono">
              {children}
            </code>
          )
        },
        table: ({ children }) => (
          <table className="w-full border-collapse overflow-x-auto border border-zinc-700 not-last:mb-2">
            {children}
          </table>
        ),
        thead: ({ children }) => (
          <thead className="bg-zinc-700">{children}</thead>
        ),
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => (
          <tr className="border-b border-zinc-700">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="border border-zinc-700 px-4 py-2 text-left">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-zinc-700 px-4 py-2">{children}</td>
        ),
        del: ({ children }) => <del className="line-through">{children}</del>,
        input: ({ type, checked }) => (
          <input
            type={type}
            checked={checked}
            readOnly
            className="h-3.5 w-3.5 shrink-0 rounded-md border border-zinc-700 bg-zinc-800 p-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  )
}
