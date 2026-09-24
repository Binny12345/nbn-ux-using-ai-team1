'use client'

import { useState } from 'react'
import { useChat } from '@/hooks/useChat'

/**
 * Minimal working chat panel — deliberately unstyled beyond basics, so you can
 * drop it into your project chat page and confirm the loop end-to-end, then
 * style it however you like.
 */
export function ChatPanel({ projectId }: { projectId: string }) {
  const { messages, isSending, error, send } = useChat(projectId)
  const [input, setInput] = useState('')

  async function handleSend() {
    const text = input
    setInput('')
    await send(text)
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === 'user' ? 'text-right' : 'text-left'}
          >
            <span className="inline-block max-w-[80%] rounded-lg px-3 py-2 text-sm">
              {m.content}
            </span>
          </div>
        ))}
        {isSending && <p className="text-sm text-zinc-500">Thinking…</p>}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
          disabled={isSending}
          placeholder="Ask about this project…"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          onClick={() => void handleSend()}
          disabled={isSending || !input.trim()}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Send
        </button>
      </div>
    </div>
  )
}