import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Styled with the marketing-* tokens instead of @tailwindcss/typography, so it matches the
// rest of the chat and doesn't depend on a plugin. Tailwind's preflight strips default
// list/heading styles, which is why they are all restored explicitly here.
const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 mb-2 text-base font-bold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 text-[15px] font-bold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="border-marketing-border my-3" />,
  blockquote: ({ children }) => (
    <blockquote className="border-marketing-border-hover text-marketing-muted my-2 border-l-[3px] pl-3">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-marketing-primary font-medium underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  // Fenced blocks arrive as <pre><code class="language-x">; inline code has no <pre> parent.
  pre: ({ children }) => (
    <pre className="bg-marketing-fg my-3 overflow-x-auto rounded-xl p-3 text-xs leading-relaxed text-white">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? '') || String(children).includes('\n')
    return isBlock ? (
      <code className="font-mono">{children}</code>
    ) : (
      <code className="bg-marketing-field-bg text-marketing-fg rounded-md px-1.5 py-0.5 font-mono text-[0.85em]">
        {children}
      </code>
    )
  },
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-marketing-border bg-marketing-field-bg border px-2.5 py-1.5 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-marketing-border border px-2.5 py-1.5 align-top">{children}</td>
  ),
  // Never load remote images from AI output (tracking / data-leak vector); show the alt text.
  img: ({ alt }) => <span className="text-marketing-muted-light">{alt}</span>,
}

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}